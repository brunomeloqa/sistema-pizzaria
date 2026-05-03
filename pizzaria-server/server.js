// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

process.env.TZ = 'America/Sao_Paulo';

// Importa os módulos de rotas
const produtoRoutes = require('./routes/produtoRoutes'); 
const clienteRoutes = require('./routes/clienteRoutes'); 
const pedidoRoutes = require('./routes/pedidoRoutes'); 
const authRoutes = require('./routes/authRoutes'); 
const userRoutes = require('./routes/userRoutes');
const configRoutes = require('./routes/configRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const mesaRoutes = require('./routes/mesaRoutes');
const caixaRoutes = require('./routes/caixaRoutes');
const entregadorRoutes = require('./routes/entregadorRoutes');
const perfilRoutes = require('./routes/perfilRoutes');
const cupomRoutes = require('./routes/cupomRoutes');

const { initDatabase } = require('./database');

const app = express();
const PORT = 3000;

const isPacked = process.pkg;
const executableDir = isPacked ? path.dirname(process.execPath) : path.join(__dirname, '..');

// Configuração de acesso para Front-end (CORS)
app.use(cors());

// Middleware para analisar o corpo das requisições JSON
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

const frontendPath = path.join(__dirname, '..', 'pizzaria-frontend', 'build'); 
app.use(express.static(frontendPath));

const uploadsPath = path.join(executableDir, 'pizzaria-server', 'uploads');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// --- INTEGRAÇÃO DE ROTAS ---
app.use('/api/produtos', produtoRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/config', configRoutes);
app.use('/api/payment-methods', paymentRoutes);
app.use('/api/mesas', mesaRoutes);
app.use('/api/caixa', caixaRoutes);
app.use('/api/entregadores', entregadorRoutes);
app.use('/api/perfis', perfilRoutes);
app.use('/api/cupons', cupomRoutes);


// Adicionando logs globais para depuração
app.use((req, res, next) => {
    console.log(`[SERVER] Requisição recebida: ${req.method} ${req.originalUrl}`);
    next();
});

// Adicionando logs para identificar o teste em execução
app.use((req, res, next) => {
    const testeAtual = req.headers['x-teste-atual'] || 'Desconhecido';
    console.log(`[SERVER] [Teste: ${testeAtual}] Requisição recebida: ${req.method} ${req.originalUrl}`);
    next();
});

// Fallback para servir o React app (DEVE estar por último)
app.use((req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Inicializar banco de dados e iniciar servidor
initDatabase().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        const os = require('os');
        const interfaces = os.networkInterfaces();
        let localIp = 'localhost';
        
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    localIp = iface.address;
                    break;
                }
            }
        }

        console.log(`\n🚀 Servidor de Pizzaria Rodando!`);
        console.log(`-------------------------------------------`);
        console.log(`🏠 Acesso Local:     http://localhost:${PORT}`);
        console.log(`🌐 Acesso na Rede:   http://${localIp}:${PORT}`);
        console.log(`-------------------------------------------\n`);
    });
}).catch(err => {
    console.error('Erro ao inicializar banco de dados:', err);
    process.exit(1);
});