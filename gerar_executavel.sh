#!/bin/bash

echo "======================================================"
echo "   GERADOR DE EXECUTAVEL - SISTEMA PIZZARIA"
echo "======================================================"
echo ""

# 1. Build do Frontend
echo "[1/2] Gerando arquivos do Frontend (React)..."
echo "Isso pode levar um minuto..."
npm run build:frontend

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERRO] Falha ao compilar o Frontend."
    echo "Verifique se ha erros no console acima."
    exit $?
fi

echo ""
echo "[OK] Frontend compilado com sucesso!"
echo ""

# 2. Build do Backend (PKG)
echo "[2/2] Gerando o executavel (.exe) com PKG..."
npm run build:backend

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERRO] Falha ao gerar o arquivo .exe."
    exit $?
fi

echo ""
echo "======================================================"
echo "   SUCESSO! O executavel foi gerado."
echo "   Arquivo: SistemaPizzaria.exe"
echo "======================================================"
echo ""
