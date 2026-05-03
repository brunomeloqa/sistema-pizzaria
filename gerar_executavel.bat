@echo off
SETLOCAL EnableDelayedExpansion

echo ======================================================
echo    GERADOR DE EXECUTAVEL - SISTEMA PIZZARIA
echo ======================================================
echo.

:: 1. Build do Frontend
echo [1/2] Gerando arquivos do Frontend (React)...
echo Isso pode levar um minuto...
call npm run build:frontend

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Falha ao compilar o Frontend.
    echo Verifique se ha erros no console acima.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [OK] Frontend compilado com sucesso!
echo.

:: 2. Build do Backend (PKG)
echo [2/2] Gerando o executavel (.exe) com PKG...
call npm run build:backend

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Falha ao gerar o arquivo .exe.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ======================================================
echo    SUCESSO! O executavel foi gerado.
echo    Arquivo: SistemaPizzaria.exe
echo ======================================================
echo.
pause
