; Script do Inno Setup para o Sistema de Pizzaria
; Crie este arquivo como 'pizzaria_setup.iss' na raiz do seu projeto.

[Setup]
; --- Informações Básicas do Aplicativo ---
AppName=Sistema PDV Pizzaria
AppVersion=1.0.0
AppPublisher=Toad
AppPublisherURL=http://localhost:3000
AppSupportURL=http://localhost:3000
AppUpdatesURL=http://localhost:3000
DefaultDirName={autopf}\Sistema Pizzaria
DefaultGroupName=Sistema PDV Pizzaria
AllowCancelDuringInstall=no
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=pizzaria.ico
UninstallDisplayIcon={app}\SistemaPizzaria.exe

; --- Diretórios de Saída ---
OutputDir=./InstaladorFinal
OutputBaseFilename=Instalador_Sistema_Pizzaria
; DisableDirPage=yes ; Esconde a tela de escolha de diretório (padrão C:\Program Files)

[Files]
; Copia o executável gerado pelo Pkg para a pasta de instalação
Source: "SistemaPizzaria.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Cria atalho no Menu Iniciar
Name: "{group}\Sistema PDV Pizzaria"; Filename: "{app}\SistemaPizzaria.exe"
; Cria atalho no Desktop (Área de Trabalho)
Name: "{commondesktop}\Sistema PDV Pizzaria"; Filename: "{app}\SistemaPizzaria.exe"

[Run]
; 1. Inicia o servidor Node.js (SistemaPizzaria.exe)
; Flags 'nowait' é crucial para que o instalador continue sem esperar o servidor fechar.
Filename: "{app}\SistemaPizzaria.exe"; Description: "Iniciar o Servidor do Sistema"; Flags: runhidden nowait postinstall skipifsilent

; 2. Abre o navegador no endereço do sistema após iniciar o servidor
; Usamos 'cmd /C start' para abrir o endereço IP no navegador padrão do usuário.
Filename: "cmd.exe"; Parameters: "/C start http://localhost:3001"; Description: "Abrir o Sistema no Navegador"; Flags: postinstall skipifsilent

[UninstallRun]
; Comando que pode ser executado na desinstalação (opcional, para garantir que o .exe feche)
Filename: "taskkill"; Parameters: "/F /IM SistemaPizzaria.exe"; Flags: runhidden