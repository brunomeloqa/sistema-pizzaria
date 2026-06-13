#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   GERADOR DE EXECUTÁVEL - SISTEMA PIZZARIA (LINUX)   ${NC}"
echo -e "${BLUE}======================================================${NC}"
echo ""

# Carrega o NVM se estiver disponível para garantir o acesso ao node/npm
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    echo -e "${YELLOW}[INFO] Carregando NVM de $HOME/.nvm...${NC}"
    export NVM_DIR="$HOME/.nvm"
    source "$NVM_DIR/nvm.sh"
elif [ -s "/usr/local/nvm/nvm.sh" ]; then
    echo -e "${YELLOW}[INFO] Carregando NVM de /usr/local/nvm...${NC}"
    export NVM_DIR="/usr/local/nvm"
    source "$NVM_DIR/nvm.sh"
fi

# Verifica se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERRO] Node.js não foi encontrado. Por favor, instale o Node.js para prosseguir.${NC}"
    exit 1
fi

# Verifica se o npm está instalado
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[ERRO] npm não foi encontrado. Por favor, instale o npm para prosseguir.${NC}"
    exit 1
fi

echo -e "${GREEN}[OK] Node.js detectado: $(node -v)${NC}"
echo -e "${GREEN}[OK] npm detectado: v$(npm -v)${NC}"
echo ""

# 1. Instalação de dependências no diretório raiz
echo -e "${YELLOW}[1/5] Instalando dependências no diretório raiz...${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERRO] Falha ao instalar dependências no diretório raiz.${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Dependências do diretório raiz instaladas.${NC}"
echo ""

# 2. Instalação de dependências no backend (pizzaria-server)
echo -e "${YELLOW}[2/5] Instalando dependências do Servidor (Backend)...${NC}"
npm install --prefix pizzaria-server
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERRO] Falha ao instalar dependências do Servidor.${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Dependências do Servidor instaladas.${NC}"
echo ""

# 3. Compilação do Frontend
echo -e "${YELLOW}[3/5] Gerando arquivos do Frontend (React)...${NC}"
echo -e "${YELLOW}Isso pode levar alguns instantes...${NC}"
npm run build:frontend
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERRO] Falha ao compilar o Frontend.${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Frontend compilado com sucesso!${NC}"
echo ""

# 4. Geração do executável (.exe)
echo -e "${YELLOW}[4/5] Gerando o executável (.exe) com PKG...${NC}"
npm run build:backend
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERRO] Falha ao gerar o executável (.exe).${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Executável (.exe) gerado com sucesso!${NC}"
echo ""

# 5. Verificação do arquivo gerado
echo -e "${YELLOW}[5/5] Verificando arquivo final...${NC}"
if [ -f "SistemaPizzaria.exe" ]; then
    FILE_SIZE=$(du -h SistemaPizzaria.exe | cut -f1)
    echo -e "${GREEN}======================================================${NC}"
    echo -e "${GREEN}   SUCESSO! O executável foi gerado.${NC}"
    echo -e "${GREEN}   Arquivo: SistemaPizzaria.exe (Tamanho: $FILE_SIZE)${NC}"
    echo -e "${GREEN}======================================================${NC}"
else
    echo -e "${RED}[ERRO] O arquivo SistemaPizzaria.exe não foi encontrado na raiz do projeto.${NC}"
    exit 1
fi
