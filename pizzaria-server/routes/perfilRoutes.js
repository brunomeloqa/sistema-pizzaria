// routes/perfilRoutes.js
const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { ensureAdmin } = require('../middleware/auth');

// Lista de todas as telas disponíveis
const TODAS_TELAS = [
    'FLUXO_CAIXA', 'NOVO_PEDIDO', 'MONITOR_COZINHA', 'SALAO',
    'ADMIN_CLIENTES', 'ADMIN_PRODUTOS', 'ADMIN_ENTREGADORES',
    'ADMIN_RELATORIOS', 'ADMIN_CONFIG'
];

// [GET] /perfis — Lista todos os perfis
router.get('/', (req, res) => {
    const database = db();
    database.all("SELECT * FROM Perfil ORDER BY id", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // Parse telas JSON
        const data = rows.map(r => ({
            ...r,
            telas: JSON.parse(r.telas || '[]')
        }));
        res.json({ data, todasTelas: TODAS_TELAS });
    });
});

// [POST] /perfis — Cria novo perfil
router.post('/', ensureAdmin, (req, res) => {
    const { nome, telas } = req.body;
    if (!nome || !telas || !Array.isArray(telas)) {
        return res.status(400).json({ error: 'Nome e lista de telas são obrigatórios.' });
    }
    const database = db();
    database.run(
        "INSERT INTO Perfil (nome, telas) VALUES (?, ?)",
        [nome, JSON.stringify(telas)],
        function(err) {
            if (err) {
                if (err.message && err.message.includes('UNIQUE')) {
                    return res.status(409).json({ error: 'Já existe um perfil com esse nome.' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: 'Perfil criado!', data: { id: this.lastID, nome, telas } });
        }
    );
});

// [PUT] /perfis/:id — Edita perfil existente
router.put('/:id', ensureAdmin, (req, res) => {
    const { id } = req.params;
    const { nome, telas } = req.body;

    // Bloqueia edição do perfil admin (id 1)
    if (parseInt(id) === 1) {
        return res.status(403).json({ error: 'O perfil admin não pode ser editado.' });
    }

    if (!nome || !telas || !Array.isArray(telas)) {
        return res.status(400).json({ error: 'Nome e lista de telas são obrigatórios.' });
    }

    const database = db();
    database.run(
        "UPDATE Perfil SET nome = ?, telas = ? WHERE id = ?",
        [nome, JSON.stringify(telas), id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Perfil não encontrado.' });
            res.json({ message: 'Perfil atualizado!' });
        }
    );
});

// [DELETE] /perfis/:id — Deleta perfil
router.delete('/:id', ensureAdmin, (req, res) => {
    const { id } = req.params;

    // Bloqueia exclusão do perfil admin (id 1)
    if (parseInt(id) === 1) {
        return res.status(403).json({ error: 'O perfil admin não pode ser deletado.' });
    }

    const database = db();
    // Verifica se há usuários usando esse perfil
    database.get("SELECT COUNT(*) as total FROM Usuario WHERE perfil_id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row && row.total > 0) {
            return res.status(400).json({ error: `Existem ${row.total} usuário(s) usando esse perfil. Altere-os primeiro.` });
        }

        database.run("DELETE FROM Perfil WHERE id = ?", [id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Perfil não encontrado.' });
            res.json({ message: 'Perfil deletado!' });
        });
    });
});

module.exports = router;
