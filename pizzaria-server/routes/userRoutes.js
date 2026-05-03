// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { db } = require('../database'); // <-- use wrapper
const { ensureAdmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// --- Rota GET: Listar Usuários (Apenas Admin) ---
router.get('/', ensureAdmin, (req, res) => {
    const database = db();
    const sql = "SELECT u.id, u.username, u.role, u.perfil_id, COALESCE(p.nome, u.role) as perfil_nome FROM Usuario u LEFT JOIN Perfil p ON u.perfil_id = p.id";
    database.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erro ao listar usuários.' });
        res.json({ data: rows });
    });
});

// --- Rota POST: Adicionar Novo Usuário (Apenas Admin) ---
router.post('/', ensureAdmin, async (req, res) => {
    const database = db();
    const { username, password, perfil_id } = req.body;
    
    if (!username || !password || !perfil_id) {
        return res.status(400).json({ error: 'Username, senha e perfil são obrigatórios.' });
    }

    try {
        // Busca o nome do perfil para usar como role
        database.get("SELECT nome FROM Perfil WHERE id = ?", [perfil_id], async (err, perfil) => {
            if (err || !perfil) return res.status(400).json({ error: 'Perfil não encontrado.' });

            const hashedPassword = await bcrypt.hash(password, 10);
            const insertSql = 'INSERT INTO Usuario (username, password, role, perfil_id) VALUES (?, ?, ?, ?)';
            database.run(insertSql, [username, hashedPassword, perfil.nome, perfil_id], function(err) {
                if (err) {
                    if (err.errno === 19 || (err.message && err.message.includes('UNIQUE'))) {
                        return res.status(409).json({ error: 'Nome de usuário já existe.' });
                    }
                    return res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
                }
                res.status(201).json({ message: 'Usuário criado com sucesso!', data: { id: this.lastID || null, username, role: perfil.nome, perfil_id } });
            });
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao criptografar senha.' });
    }
});

// --- Rota DELETE: Deletar Usuário (Apenas Admin) ---
router.delete('/:id', ensureAdmin, (req, res) => {
    const database = db();
    const { id } = req.params;
    // Impedir exclusão do próprio usuário ou do admin inicial (ID 1)
    if (parseInt(id) === 1) {
        return res.status(403).json({ error: 'Não é possível excluir o usuário administrador inicial.' });
    }
    
    const sql = 'DELETE FROM Usuario WHERE id = ?';
    database.run(sql, [id], function(err) {
        if (err) return res.status(500).json({ error: 'Erro ao deletar usuário.' });
        if (this.changes === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
        res.json({ message: 'Usuário deletado com sucesso.' });
    });
});

module.exports = router;