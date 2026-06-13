const { exec } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

/**
 * Envia buffer ESC/POS para a impressora no Windows.
 *
 * Estratégia (em ordem, sem compilação C# em nenhuma delas):
 *  1. Se printerName é COM/LPT → copy /b direto na porta
 *  2. Descobre a porta da impressora no Windows:
 *     a) Se for COM/LPT → copy /b direto (mais confiável)
 *     b) Se for USB → escreve via [System.IO.FileStream] no path \\.\<porta>
 *  3. Fallback: System.Printing.PrintQueue.AddJob() (carrega DLL do GAC, sem compilação)
 *  4. Fallback final: copy /b via compartilhamento \\localhost\NomeImpressora
 */
function enviarParaImpressora(tempFilePath, printerName) {
    return new Promise((resolve, reject) => {
        if (!printerName)
            return reject(new Error('Impressora não configurada.'));

        if (process.platform !== 'win32') {
            console.log(`[Printer] SIMULAÇÃO: ${path.basename(tempFilePath)} → ${printerName}`);
            return resolve();
        }

        // 1. Porta direta (COM1, LPT1) configurada pelo usuário
        if (/^(COM|LPT)\d+$/i.test(printerName)) {
            console.log(`[Printer] Porta direta: copy /b para ${printerName}`);
            return _runCmd(
                `cmd.exe /c copy /b "${tempFilePath}" "${printerName}"`,
                resolve, reject, 'copy/b-direto'
            );
        }

        // 2. Impressora nomeada: detecta porta no Windows e aplica melhor método
        let primaryErr = null;

        _getPortName(printerName)
            .then(rawPort => {
                const port = (rawPort || '').trim();
                console.log(`[Printer] "${printerName}" → porta detectada: "${port}"`);

                // 2a. COM/LPT: copia diretamente (ignora spooler e driver)
                if (port && /^(COM|LPT)\d+$/i.test(port)) {
                    console.log(`[Printer] Enviando via copy /b para porta serial ${port}`);
                    return new Promise((res, rej) =>
                        _runCmd(`cmd.exe /c copy /b "${tempFilePath}" "${port}"`, res, rej, 'copy/b-com'));
                }

                // 2b. USB ou rede: P/Invoke com PRINTER_DEFAULTS forçando RAW
                console.log(`[Printer] USB/Rede: P/Invoke RAW para "${printerName}"`);
                return _printViaPInvoke(tempFilePath, printerName);
            })
            .catch(err => {
                primaryErr = err;
                console.warn(`[Printer] Falha primária: ${err.message}`);
                console.log('[Printer] Fallback: System.Printing...');
                return _printViaSystemPrinting(tempFilePath, printerName);
            })
            .catch(sysErr => {
                const prev = primaryErr ? `Primário: ${primaryErr.message} | ` : '';
                console.warn(`[Printer] Falha System.Printing: ${sysErr.message}`);
                console.log('[Printer] Fallback final: copy /b via UNC local...');
                return _printViaUNC(tempFilePath, printerName)
                    .catch(uncErr => {
                        throw new Error(
                            `${prev}System.Printing: ${sysErr.message} | UNC: ${uncErr.message}`
                        );
                    });
            })
            .then(resolve)
            .catch(reject);
    });
}

// ── Helpers de detecção de porta ──────────────────────────────────────────

function _getPortName(printerName) {
    const safe = printerName.replace(/'/g, "''");
    // Tenta 3 abordagens diferentes (Windows 7, 8, 10/11)
    const script = `
$ErrorActionPreference = 'SilentlyContinue'
$port = ""
try   { $port = (Get-Printer -Name '${safe}').PortName } catch {}
if (-not $port) {
    try { $port = (Get-CimInstance Win32_Printer -Filter "Name='${safe}'").PortName } catch {}
}
if (-not $port) {
    try { $port = (Get-WmiObject  Win32_Printer -Filter "Name='${safe}'").PortName } catch {}
}
if ($port) { Write-Host $port.Trim() }
`.trim();
    return _execPs1(script, 'GetPortName').catch(() => '');
}

// ── Métodos de impressão ──────────────────────────────────────────────────

/**
 * Método A: winspool.drv P/Invoke com PRINTER_DEFAULTS forçando RAW.
 * Abre a impressora já com pDatatype="RAW" no nível da conexão,
 * impedindo que o driver do fabricante intercepte e converta os dados.
 * Usa Add-Type -TypeDefinition (compila C# em runtime via csc.exe).
 */
function _printViaPInvoke(tempFilePath, printerName) {
    const pPrinter = printerName.replace(/'/g, "''");
    const pFile    = tempFilePath.replace(/'/g, "''");

    const script = `
$ErrorActionPreference = 'Stop'
$src = @'
using System;
using System.IO;
using System.Runtime.InteropServices;
public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public struct PrinterDefaults {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDatatype;
        public IntPtr pDevMode;
        public int DesiredAccess;
    }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public struct DocInfo1 {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDatatype;
    }
    [DllImport("winspool.drv", EntryPoint="OpenPrinterW", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern bool OpenPrinter(string name, out IntPtr h, ref PrinterDefaults d);
    [DllImport("winspool.drv", EntryPoint="StartDocPrinterW", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern int StartDocPrinter(IntPtr h, int lv, ref DocInfo1 di);
    [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr h, IntPtr p, int n, out int w);
    [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);
    public static string Send(string printer, string file) {
        PrinterDefaults pd = new PrinterDefaults();
        pd.pDatatype = "RAW";
        pd.DesiredAccess = 8; // PRINTER_ACCESS_USE
        IntPtr h;
        if (!OpenPrinter(printer, out h, ref pd))
            return "OpenPrinter falhou cod=" + Marshal.GetLastWin32Error();
        DocInfo1 di = new DocInfo1();
        di.pDocName  = "Pedido";
        di.pDatatype = "RAW";
        int job = StartDocPrinter(h, 1, ref di);
        if (job == 0) { ClosePrinter(h); return "StartDocPrinter falhou cod=" + Marshal.GetLastWin32Error(); }
        if (!StartPagePrinter(h)) { EndDocPrinter(h); ClosePrinter(h); return "StartPagePrinter falhou cod=" + Marshal.GetLastWin32Error(); }
        byte[] b = File.ReadAllBytes(file);
        IntPtr p = Marshal.AllocCoTaskMem(b.Length);
        Marshal.Copy(b, 0, p, b.Length);
        int w = 0;
        bool ok = WritePrinter(h, p, b.Length, out w);
        Marshal.FreeCoTaskMem(p);
        EndPagePrinter(h); EndDocPrinter(h); ClosePrinter(h);
        return ok ? "OK:" + w + " bytes" : "WritePrinter falhou cod=" + Marshal.GetLastWin32Error();
    }
}
'@
try { Add-Type -TypeDefinition $src -Language CSharp } catch { Write-Error "Add-Type: $_"; exit 1 }
$r = [RawPrinter]::Send('${pPrinter}', '${pFile}')
Write-Host $r
if ($r -notlike 'OK*') { Write-Error $r; exit 1 }
`.trim();

    return _execPs1(script, 'P/Invoke').then(out => {
        console.log(`[Printer] P/Invoke resultado: ${out}`);
    });
}

/**
 * Método B: System.Printing.PrintQueue.AddJob()
 * Carrega DLL do GAC do .NET Framework — sem compilação de código.
 */
function _printViaSystemPrinting(tempFilePath, printerName) {
    const pPrinter = printerName.replace(/'/g, "''");
    const pFile    = tempFilePath.replace(/'/g, "''");

    const script = `
$ErrorActionPreference = 'Stop'
try {
    Add-Type -AssemblyName System.Printing
    $srv   = New-Object System.Printing.LocalPrintServer
    $queue = $srv.GetPrintQueue('${pPrinter}')
    $job   = $queue.AddJob('Pedido')
    $bytes = [System.IO.File]::ReadAllBytes('${pFile}')
    $job.JobStream.Write($bytes, 0, $bytes.Length)
    $job.JobStream.Flush()
    $job.JobStream.Close()
    Write-Host "OK $($bytes.Length) bytes"
} catch {
    Write-Error $_.Exception.Message; exit 1
}
`.trim();

    return _execPs1(script, 'System.Printing').then(out => {
        console.log(`[Printer] System.Printing resultado: ${out}`);
    });
}

/**
 * Método C: copy /b via porta COM/LPT física — para porta serial/paralela.
 */
function _printViaPort(tempFilePath, portName) {
    return new Promise((resolve, reject) =>
        _runCmd(`cmd.exe /c copy /b "${tempFilePath}" "${portName}"`, resolve, reject, `copy/b-${portName}`)
    );
}

// ── Utilitários ───────────────────────────────────────────────────────────

function _runCmd(cmd, resolve, reject, label) {
    exec(cmd, { timeout: 20000 }, (err, _, stderr) => {
        if (err) return reject(new Error(`${label} falhou: ${(stderr || err.message).trim()}`));
        resolve();
    });
}

function _execPs1(scriptContent, label) {
    const scriptPath = path.join(os.tmpdir(), `ps_${Date.now()}_${Math.random().toString(36).slice(2)}.ps1`);
    fs.writeFileSync(scriptPath, scriptContent, 'utf8');
    const cmd = `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`;
    return new Promise((resolve, reject) => {
        exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
            try { fs.unlinkSync(scriptPath); } catch (_) {}
            if (err) {
                const detail = (stderr || '').trim() || err.message;
                return reject(new Error(`${label}: ${detail}`));
            }
            resolve(stdout.trim());
        });
    });
}

module.exports = { enviarParaImpressora };
