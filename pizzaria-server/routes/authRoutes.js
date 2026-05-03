// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { initDatabase } = require('../database');
const { comparePassword } = require('../utils/hash');

const JWT_SECRET = 'Qc8yH#5g9Kz@r!vLx$2nB&pTfWuJmZdE4aR7s6I1tA9o0';

// Rota POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username e senha são obrigatórios.' });
        }

        // Obter instância do banco de dados
        const { db } = require('../database');
        const database = db();

        // 1. Buscar usuário no banco de dados com JOIN no Perfil
        database.get("SELECT u.*, p.nome as perfil_nome, p.telas FROM Usuario u LEFT JOIN Perfil p ON u.perfil_id = p.id WHERE u.username = ?", [username], async (err, user) => {
            if (err) {
                console.error('Erro na query:', err);
                return res.status(500).json({ error: 'Erro ao buscar usuário.' });
            }

            if (!user) {
                return res.status(401).json({ error: 'Credenciais inválidas.' });
            }

            // 2. Comparar a senha fornecida com o hash armazenado
            const { comparePassword } = require('../utils/hash');
            const isMatch = await comparePassword(password, user.password);

            if (!isMatch) {
                return res.status(401).json({ error: 'Credenciais inválidas.' });
            }

            // Parse telas do perfil
            let telas = [];
            try { telas = JSON.parse(user.telas || '[]'); } catch(e) {}
            
            // Admin sempre tem acesso a tudo
            const role = user.perfil_nome || user.role || 'atendente';
            if (role === 'admin') {
                telas = ["FLUXO_CAIXA","NOVO_PEDIDO","MONITOR_COZINHA","SALAO","ADMIN_CLIENTES","ADMIN_PRODUTOS","ADMIN_ENTREGADORES","ADMIN_RELATORIOS","ADMIN_CONFIG"];
            }

            // 3. Gerar o JWT (JSON Web Token)
            const token = jwt.sign(
                { 
                    id: user.id, 
                    username: user.username,
                    role: role,
                    telas: telas
                },
                JWT_SECRET,
                { expiresIn: '8h' }
            );

            // 4. Retorna o token para o cliente
            res.json({
                message: 'Login bem-sucedido!',
                token,
                role: role,
                telas: telas
            });
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro ao processar login.' });
    }
});

module.exports = router;