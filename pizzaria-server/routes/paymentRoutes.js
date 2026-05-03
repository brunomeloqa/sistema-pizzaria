const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');

/*
// Middleware de autorização (Verifica se o usuário é 'admin')
const ensureAdmin = (req, res, next) => {
    // 🚨 ASSUME-SE que 'ensureAuthenticated' adicionou req.user.role
    if (req.user && req.user.role === 'admin') {
        next(); // Usuário é Admin, pode prosseguir
    } else {
        res.status(403).json({ error: 'Acesso negado. Apenas administradores podem gerenciar modos de pagamento.' });
    }
};*/

// Rota 1: GET /api/payment-methods - Lista todos os modos
// Adicionando logs para depuração na rota GET ALL Métodos
router.get('/', ensureAuthenticated, (req, res) => {
    var database = db();
    database.all("SELECT * FROM ModosDePagamento ORDER BY nome ASC", [], (err, rows) => {
        if (err) {
            console.error("[GET /api/payment-methods] Erro ao buscar modos de pagamento:", err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log("[GET /api/payment-methods] Dados retornados:", rows);
        res.json({ data: rows });
    });
});

// Rota 2: POST /api/payment-methods - Adiciona novo modo
// Adicionando logs para depuração na rota POST
router.post('/', ensureAuthenticated, ensureAdmin, (req, res) => {
    console.log("[POST /api/payment-methods] Requisição recebida com dados:", req.body);
    var database = db();
    var { nome } = req.body;
    if (!nome) {
        console.error("[POST /api/payment-methods] Falha: Nome do modo de pagamento não fornecido.");
        return res.status(400).json({ error: "O nome do modo de pagamento é obrigatório." });
    }
    const sql = "INSERT INTO ModosDePagamento (nome, ativo) VALUES (?, 1)";
    database.run(sql, [nome], function(err) {
        if (err) {
            console.error("[POST /api/payment-methods] Erro ao adicionar modo de pagamento:", err.message);
            return res.status(500).json({ error: "Erro ao adicionar modo de pagamento: " + err.message });
        }
        console.log("[POST /api/payment-methods] Sucesso: Modo de pagamento adicionado com ID:", this.lastID);
        res.status(201).json({ id: this.lastID, nome, ativo: 1 });
    });
});

// Rota 3: PUT /api/payment-methods/:id - Atualiza status (ativo/inativo)
router.put('/:id', ensureAuthenticated, ensureAdmin, (req, res) => {
    const database = db();
    const { id } = req.params;
    const { nome, ativo } = req.body;
    
    let updates = [];
    let params = [];
    
    if (nome !== undefined) {
        updates.push("nome = ?");
        params.push(nome);
    }
    if (ativo !== undefined) {
        updates.push("ativo = ?");
        params.push(ativo);
    }
    if (req.body.is_cupom !== undefined) {
        updates.push("is_cupom = ?");
        params.push(req.body.is_cupom ? 1 : 0);
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: "Nenhum campo para atualizar fornecido." });
    }

    const sql = `UPDATE ModosDePagamento SET ${updates.join(', ')} WHERE id = ?`;
    params.push(id);

    database.run(sql, params, function(err) {
        if (err) return res.status(500).json({ error: "Erro ao atualizar modo de pagamento: " + err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Modo de pagamento não encontrado." });
        res.json({ message: "Modo de pagamento atualizado com sucesso." });
    });
});

// Rota 4: DELETE /api/payment-methods/:id - Deleta modo
router.delete('/:id', ensureAuthenticated, ensureAdmin, (req, res) => {
    const database = db();
    const { id } = req.params;
    const sql = "DELETE FROM ModosDePagamento WHERE id = ?";
    database.run(sql, [id], function(err) {
        if (err) return res.status(500).json({ error: "Erro ao deletar modo de pagamento: " + err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Modo de pagamento não encontrado." });
        res.json({ message: "Modo de pagamento deletado com sucesso." });
    });
});

module.exports = router;