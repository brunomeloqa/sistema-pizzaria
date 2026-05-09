const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { ensureAuthenticated } = require('../middleware/auth');

// Get all funcionarios
router.get('/', ensureAuthenticated, (req, res) => {
    db().all("SELECT * FROM Funcionario ORDER BY nome", [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// Create funcionario
router.post('/', ensureAuthenticated, (req, res) => {
    const { nome, funcao, tipo_pagamento, valor_pagamento } = req.body;
    db().run(
        `INSERT INTO Funcionario (nome, funcao, tipo_pagamento, valor_pagamento, saldo, ativo) 
         VALUES (?, ?, ?, ?, 0, 1)`,
        [nome, funcao, tipo_pagamento, valor_pagamento],
        function(err) {
            if (err) return res.status(400).json({ message: err.message });
            res.status(201).json({ id: this.lastID, message: 'Funcionário criado com sucesso!' });
        }
    );
});

// Edit funcionario
router.put('/:id', ensureAuthenticated, (req, res) => {
    const { nome, funcao, tipo_pagamento, valor_pagamento, ativo } = req.body;
    db().run(
        `UPDATE Funcionario SET 
            nome = COALESCE(?, nome), 
            funcao = COALESCE(?, funcao), 
            tipo_pagamento = COALESCE(?, tipo_pagamento), 
            valor_pagamento = COALESCE(?, valor_pagamento),
            ativo = COALESCE(?, ativo)
         WHERE id = ?`,
        [nome, funcao, tipo_pagamento, valor_pagamento, ativo, req.params.id],
        function(err) {
            if (err) return res.status(400).json({ message: err.message });
            res.json({ message: 'Funcionário atualizado com sucesso!' });
        }
    );
});

// Delete/Deactivate funcionario
router.delete('/:id', ensureAuthenticated, (req, res) => {
    db().run("UPDATE Funcionario SET ativo = 0 WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(400).json({ message: err.message });
        res.json({ message: 'Funcionário desativado com sucesso!' });
    });
});

// Get lancamentos by funcionario
router.get('/:id/lancamentos', ensureAuthenticated, (req, res) => {
    db().all(
        `SELECT l.*, p.nome as produto_nome 
         FROM FuncionarioLancamento l 
         LEFT JOIN Produto p ON l.produto_id = p.id 
         WHERE l.funcionario_id = ? 
         ORDER BY l.data_lancamento DESC`,
        [req.params.id],
        (err, rows) => {
            if (err) return res.status(500).json({ message: err.message });
            res.json(rows);
        }
    );
});

// Add lancamento
router.post('/:id/lancamentos', ensureAuthenticated, (req, res) => {
    const { tipo, categoria, valor, descricao, produto_id } = req.body;
    const funcionario_id = req.params.id;

    // Se for crédito, adiciona ao saldo. Se for débito, subtrai.
    let valorAjustado = tipo === 'Crédito' ? valor : -valor;

    db().run(
        `INSERT INTO FuncionarioLancamento (funcionario_id, tipo, categoria, valor, descricao, produto_id) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [funcionario_id, tipo, categoria, valor, descricao, produto_id || null],
        function(err) {
            if (err) return res.status(400).json({ message: err.message });

            // Update saldo
            db().run(
                `UPDATE Funcionario SET saldo = saldo + ? WHERE id = ?`,
                [valorAjustado, funcionario_id],
                function(errU) {
                    if (errU) return res.status(400).json({ message: errU.message });
                    res.status(201).json({ message: 'Lançamento registrado com sucesso!' });
                }
            );
        }
    );
});

module.exports = router;
