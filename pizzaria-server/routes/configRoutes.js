// routes/configRoutes.js
const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { ensureAdmin } = require('../middleware/auth');
const multer = require('multer'); 
const path = require('path');
const fs = require('fs');

const isPacked = process.pkg; 
const executableDir = isPacked ? path.dirname(process.execPath) : path.join(__dirname, '..', '..');
const uploadDir = path.join(executableDir, 'pizzaria-server', 'uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// --- Rota GET: Buscar Configurações ---
router.get('/', (req, res) => {
    const database = db();
    const sql = "SELECT * FROM Configuracoes WHERE id = 1";
    database.get(sql, [], (err, row) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar configurações.' });

        if (row && row.print_order) {
            try { row.print_order = JSON.parse(row.print_order); }
            catch (e) { 
                if (typeof row.print_order === 'string') {
                    row.print_order = row.print_order.split(',').map(s => s.trim()).filter(Boolean);
                } else { row.print_order = []; }
            }
        } else { row.print_order = []; }

        // Trata print_order_cozinha
        if (row && row.print_order_cozinha) {
            try { row.print_order_cozinha = JSON.parse(row.print_order_cozinha); }
            catch (e) { row.print_order_cozinha = String(row.print_order_cozinha).split(',').map(s => s.trim()).filter(Boolean); }
        } else { row.print_order_cozinha = []; }

        // Trata print_order_entregador
        if (row && row.print_order_entregador) {
            try { row.print_order_entregador = JSON.parse(row.print_order_entregador); }
            catch (e) { row.print_order_entregador = String(row.print_order_entregador).split(',').map(s => s.trim()).filter(Boolean); }
        } else { row.print_order_entregador = []; }

        console.log("✅ Config enviada ao frontend:", row); // DEBUG
        res.json({ data: row });
    });
});

// --- Rota PUT: Atualizar Configurações (Apenas Admin) ---
router.put('/', ensureAdmin, (req, res) => {
    const database = db();
    const data = req.body;

    if (Array.isArray(data.print_order)) {
        data.print_order = data.print_order.join(',');
    }
    if (Array.isArray(data.print_order_cozinha)) {
        data.print_order_cozinha = data.print_order_cozinha.join(',');
    }
    if (Array.isArray(data.print_order_entregador)) {
        data.print_order_entregador = data.print_order_entregador.join(',');
    }

    // Sanitização de campos que devem ser Inteiros (0 ou 1)
    const toInt = (val) => (val === true || val === 1 || val === '1') ? 1 : 0;

    const sql = `UPDATE Configuracoes SET 
        nome_pizzaria = ?, endereco = ?, rua = ?, bairro = ?, 
        cidade = ?, estado = ?, telefone = ?, cnpj = ?, 
        show_itens_pedido = ?, show_valor_total = ?, 
        print_order = ?, print_order_cozinha = ?, print_order_entregador = ?,
        taxa_servico_padrao = ?, calculo_pizza = ?,
        historico_pedidos_limite = ?, impressora_caminho = ?,
        impressora_tipo = ?, print_font_size = ?
        WHERE id = 1`;

    const params = [
        data.nome_pizzaria, data.endereco, data.rua, data.bairro,
        data.cidade, data.estado, data.telefone, data.cnpj,
        toInt(data.show_itens_pedido), toInt(data.show_valor_total),
        data.print_order, data.print_order_cozinha, data.print_order_entregador,
        parseFloat(data.taxa_servico_padrao) || 0, data.calculo_pizza ?? 'maior',
        parseInt(data.historico_pedidos_limite) ?? 10,
        data.impressora_caminho ?? 'COM1', data.impressora_tipo ?? 'serial',
        data.print_font_size ?? 'Normal'
    ];

    database.run(sql, params, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Configurações atualizadas!' });
    });
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); // Salva na pasta 'uploads'
    },
    filename: (req, file, cb) => {
        // Renomeia o arquivo para um nome fixo (ex: logo.png), para ter apenas um
        const extension = path.extname(file.originalname);
        cb(null, 'logo' + extension);
    }
});

const upload = multer({ storage: storage }); // Middleware de upload

// --- Rota POST: Upload do Logo (Apenas Admin) ---
router.post('/upload-logo', ensureAdmin, upload.single('logo'), (req, res) => {
    const database = db();
    
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    // URL para acesso estático (será ajustada no server.js)
    const logoUrl = `/uploads/${req.file.filename}`;

    // Atualiza a URL no banco de dados
    const sql = `UPDATE Configuracoes SET logo_url = ? WHERE id = 1`;
    database.run(sql, [logoUrl], function(err) {
        if (err) {
            console.error("Erro ao salvar URL do logo:", err.message);
            return res.status(500).json({ error: 'Logo enviado, mas erro ao salvar URL no DB.' });
        }
        res.json({ message: 'Logo enviado e URL salva!', logo_url: logoUrl });
    });
});

router.post('/test-print', ensureAdmin, async (req, res) => {
    const database = db();
    const { formatarPedidoParaImpressao } = require('../services/printFormatter');
    const fs = require('fs');
    const path = require('path');

    database.get("SELECT * FROM Configuracoes WHERE id = 1", [], async (err, config) => {
        if (err) return res.status(500).send("Erro ao buscar config");
        const reqLayoutType = req.body.layoutType || 'geral';

        // Garante que os print_order tenham valor padrão caso não configurados
        const defaultOrder = 'num_pedido,dados_cliente,itens_pedido,valor_total,modo_pagamento,observacao';
        if (!config.print_order) config.print_order = defaultOrder;
        if (!config.print_order_cozinha) config.print_order_cozinha = config.print_order || defaultOrder;
        if (!config.print_order_entregador) config.print_order_entregador = config.print_order || defaultOrder;

        // Simula um pedido fictício completo para o teste
        const pedidoTeste = {
            id: "999",
            cliente_nome: "CLIENTE TESTE",
            cliente_telefone: "(11) 99999-9999",
            endereco_entrega: "Rua Exemplo, 123",
            complemento_entrega: "Apto 45",
            valor_total: 99.90,
            forma_pagamento: "PIX",
            observacao: "Teste de impressão - " + reqLayoutType.toUpperCase(),
            tipo_entrega: reqLayoutType === 'cozinha' ? 'balcao' : 'entrega',
            itens: [
                { quantidade: 1, nome: "PIZZA TESTE CALABRESA", valor: 49.95, observacao: "Sem cebola" },
                { quantidade: 1, nome: "PIZZA TESTE MUSSARELA", valor: 49.95, observacao: "" }
            ]
        };

        try {
            const buffer = await formatarPedidoParaImpressao(pedidoTeste, config, reqLayoutType);
            
            if (!buffer || buffer.length === 0) {
                return res.status(500).json({ error: "Buffer de impressão vazio. Verifique as configurações de layout." });
            }

            const os = require('os');
            const tempFile = path.join(os.tmpdir(), `teste_print_${Date.now()}.bin`);
            fs.writeFileSync(tempFile, buffer);
            
            if (!config.impressora_caminho) {
                try { fs.unlinkSync(tempFile); } catch(e) {}
                return res.status(400).json({ error: "Nenhuma impressora selecionada. Configure a impressora na aba 'Geral'." });
            }

            const { enviarParaImpressora } = require('../services/printExecutor');

            console.log(`[Teste Impressão] Layout: ${reqLayoutType} | Impressora: ${config.impressora_caminho}`);
            enviarParaImpressora(tempFile, config.impressora_caminho)
                .then(() => {
                    res.json({ message: `Teste de impressão (${reqLayoutType}) enviado com sucesso!` });
                })
                .catch((printErr) => {
                    console.error('[Teste Impressão] Erro ao enviar:', printErr.message);
                    res.status(500).json({ error: "Falha ao enviar para a impressora", details: printErr.message });
                })
                .finally(() => {
                    try {
                        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                    } catch(e) {}
                });

        } catch (e) {
            console.error("Erro no test-print:", e);
            res.status(500).json({ error: "Erro ao gerar buffer de impressão", details: e.message });
        }
    });
});

// --- Endpoint de diagnóstico: envia bytes ESC/POS hardcoded, sem layout ---
// Útil para verificar se a impressora aceita dados RAW, ignorando o gerador de layout.
router.post('/test-print-raw', ensureAdmin, (req, res) => {
    const database = db();
    database.get("SELECT impressora_caminho FROM Configuracoes WHERE id = 1", [], async (err, config) => {
        if (err || !config || !config.impressora_caminho)
            return res.status(400).json({ error: 'Impressora não configurada nas configurações.' });

        const fs   = require('fs');
        const os   = require('os');
        const path = require('path');
        const { enviarParaImpressora } = require('../services/printExecutor');

        // Bytes ESC/POS mínimos: inicializar + centralizar + texto + alimentar + cortar
        const escpos = Buffer.from([
            0x1B, 0x40,             // ESC @ - reinicializar
            0x1B, 0x61, 0x01,       // ESC a 1 - centralizar
            0x1B, 0x21, 0x20,       // ESC ! - negrito
            ...Buffer.from('*** TESTE IMPRESSORA ***\n', 'ascii'),
            0x1B, 0x21, 0x00,       // ESC ! - normal
            ...Buffer.from('Sistema Pizzaria - RAW OK\n', 'ascii'),
            ...Buffer.from('------------------------\n', 'ascii'),
            0x1B, 0x64, 0x05,       // ESC d 5 - avança 5 linhas
            0x1D, 0x56, 0x41, 0x05  // GS V A - corte parcial
        ]);

        const tempFile = path.join(os.tmpdir(), `raw_test_${Date.now()}.bin`);
        fs.writeFileSync(tempFile, escpos);

        console.log(`[Teste RAW] Enviando ${escpos.length} bytes para: ${config.impressora_caminho}`);
        enviarParaImpressora(tempFile, config.impressora_caminho)
            .then(() => {
                res.json({ message: `✅ ${escpos.length} bytes RAW enviados com sucesso para a fila de impressão!` });
            })
            .catch(e => {
                res.status(500).json({ error: 'Falha ao enviar bytes RAW', details: e.message });
            })
            .finally(() => { try { fs.unlinkSync(tempFile); } catch(_){} });
    });
});

// --- Endpoint para listar impressoras do Windows ---
router.get('/printers', ensureAdmin, (req, res) => {
    const { exec } = require('child_process');

    if (process.platform !== 'win32') {
        // Mock para desenvolvimento em ambiente não-Windows (Linux/macOS)
        return res.json({ printers: ['Impressora Teste 1 (Virtual)', 'Impressora Teste 2 (Virtual)', 'COM1', 'LPT1'] });
    }

    const script = `
$printers = @()
try {
    Add-Type -AssemblyName System.Drawing
    $printers += [System.Drawing.Printing.PrinterSettings]::InstalledPrinters
} catch {}
if ($printers.Count -eq 0) {
    try {
        $printers += (Get-Printer | Select-Object -ExpandProperty Name)
    } catch {}
}
if ($printers.Count -eq 0) {
    try {
        $printers += (Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name)
    } catch {}
}
if ($printers.Count -eq 0) {
    try {
        $wmicOut = wmic printer get name
        $printers += ($wmicOut | Select-String -Pattern '\\S' | Select-Object -Skip 1 | ForEach-Object { $_.ToString().Trim() })
    } catch {}
}
$printers = $printers | Select-Object -Unique | Where-Object { $_ }
if ($printers) {
    $printers | ConvertTo-Json -Compress
} else {
    "[]"
}
`;

    const buffer = Buffer.from(script, 'utf16le');
    const base64 = buffer.toString('base64');
    const comando = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${base64}`;
    
    exec(comando, (err, stdout, stderr) => {
        if (err) {
            console.error('Erro ao listar impressoras com script robusto:', err.message, stderr);
            return res.json({ printers: [] });
        }
        try {
            const output = stdout.trim();
            if (!output || output === '[]') {
                return res.json({ printers: [] });
            }
            
            let printers = JSON.parse(output);
            if (!Array.isArray(printers)) {
                printers = printers ? [printers] : [];
            }
            
            // Remove duplicatas se houver
            const printerNames = [...new Set(printers)].filter(Boolean);
            res.json({ printers: printerNames });
        } catch (e) {
            console.error('Erro ao parsear impressoras:', e.message, 'Raw Output:', stdout);
            res.json({ printers: [] });
        }
    });
});

// --- Rota DELETE: Limpar Banco de Dados (Apenas Admin, para testes) ---
router.delete('/limpar-banco', ensureAdmin, (req, res) => {
    const database = db();

    try {
        // Ordem importa por causa de foreign keys: limpar filhos antes dos pais
        database.run('DELETE FROM HistoricoPagamentoEntregador', [], () => {});
        database.run('DELETE FROM HistoricoEntrega', [], () => {});
        database.run('DELETE FROM HistoricoFluxoCaixa', [], () => {});
        database.run('DELETE FROM FluxoCaixa', [], () => {});
        database.run('DELETE FROM PedidoPagamento', [], () => {});
        database.run('DELETE FROM ItemPedido', [], () => {});
        database.run('DELETE FROM Pedido', [], () => {});
        database.run('DELETE FROM Cliente', [], () => {});
        database.run('DELETE FROM Entregador', [], () => {});
        database.run('DELETE FROM Mesa', [], () => {});
        database.run('DELETE FROM ModosDePagamento', [], () => {});
        database.run('DELETE FROM Produto', [], () => {});

        // Reinsere os dados iniciais essenciais
        database.run("INSERT OR IGNORE INTO ModosDePagamento (nome) VALUES (?)", ['Dinheiro'], () => {});
        database.run("INSERT OR IGNORE INTO ModosDePagamento (nome) VALUES (?)", ['Cartão (Débito)'], () => {});
        database.run("INSERT OR IGNORE INTO ModosDePagamento (nome) VALUES (?)", ['Cartão (Crédito)'], () => {});
        database.run("INSERT OR IGNORE INTO ModosDePagamento (nome) VALUES (?)", ['Pix'], () => {});

        for (let i = 1; i <= 10; i++) {
            const num = String(i).padStart(2, '0');
            database.run("INSERT OR IGNORE INTO Mesa (numero, status) VALUES (?, ?)", [num, 'Livre'], () => {});
        }

        console.log('🗑️ Banco de dados limpo com sucesso (usuários e configurações preservados).');
        res.json({ message: 'Banco de dados limpo com sucesso! Cardápio, clientes, pedidos, entregadores, mesas, modos de pagamento e históricos foram removidos. Usuários e configurações foram mantidos.' });
    } catch (err) {
        console.error('❌ Erro ao limpar banco de dados:', err.message);
        res.status(500).json({ error: 'Erro ao limpar banco de dados: ' + err.message });
    }
});

module.exports = router;