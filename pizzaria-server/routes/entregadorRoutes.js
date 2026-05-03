const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { ensureAdmin } = require('../middleware/auth'); // Opcional: Proteger rotas

// 1. Listar todos os entregadores
router.get('/', (req, res) => {
    const database = db();
    const sql = "SELECT * FROM Entregador ORDER BY id DESC";
    
    database.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// 2. Criar novo entregador
router.post('/', ensureAdmin, (req, res) => {
    const { nome, contato } = req.body;
    
    if (!nome) {
        return res.status(400).json({ error: "O nome do entregador é obrigatório." });
    }

    const database = db();
    const sql = "INSERT INTO Entregador (nome, contato, quantidade_entregas_dia, ativo) VALUES (?, ?, 0, 1)";
    
    database.run(sql, [nome, contato || null], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Entregador adicionado com sucesso!", id: this.lastID });
    });
});

// 3. Atualizar entregador (dados, status ativo, etc)
router.put('/:id', ensureAdmin, (req, res) => {
    const { id } = req.params;
    const { nome, contato, quantidade_entregas_dia, ativo } = req.body;
    
    const fields = [];
    const values = [];
    
    if (nome !== undefined) { fields.push('nome = ?'); values.push(nome); }
    if (contato !== undefined) { fields.push('contato = ?'); values.push(contato); }
    if (quantidade_entregas_dia !== undefined) { fields.push('quantidade_entregas_dia = ?'); values.push(quantidade_entregas_dia); }
    if (ativo !== undefined) { fields.push('ativo = ?'); values.push(ativo ? 1 : 0); }

    if (fields.length === 0) {
        return res.status(400).json({ error: "Nenhum campo para atualizar." });
    }

    values.push(id);
    const sql = `UPDATE Entregador SET ${fields.join(', ')} WHERE id = ?`;

    const database = db();
    database.run(sql, values, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Entregador atualizado!" });
    });
});

// 5. Obter histórico completo (Entregas e Pagamentos)
router.get('/:id/historico', (req, res) => {
    const { id } = req.params;
    const database = db();
    
    // Busca entregas
    const sqlEntregas = `
        SELECT 'ENTREGA' as tipo, h.valor_taxa as valor, h.data_hora as data, p.id as pedido_id
        FROM HistoricoEntrega h
        LEFT JOIN Pedido p ON h.pedido_id = p.id
        WHERE h.entregador_id = ?
    `;
    
    database.all(sqlEntregas, [id], (errE, entregas) => {
        if (errE) return res.status(500).json({ error: errE.message });
        
        // Busca pagamentos e ajustes
        const sqlPagamentos = `
            SELECT CASE WHEN valor < 0 THEN 'TAXA' ELSE 'PAGAMENTO' END as tipo, valor, data_pagamento as data, NULL as pedido_id, descricao
            FROM HistoricoPagamentoEntregador
            WHERE entregador_id = ?
        `;
        
        database.all(sqlPagamentos, [id], (errP, pagamentos) => {
            if (errP) return res.status(500).json({ error: errP.message });
            
            // Combina e ordena por data decrescente
            const historico = [...entregas, ...pagamentos].sort((a, b) => new Date(b.data) - new Date(a.data));
            res.json({ data: historico });
        });
    });
});

// 6. Realizar pagamento de saldo (Payout)
router.post('/:id/payout', ensureAdmin, (req, res) => {
    const { id } = req.params;
    const { valor, descricao } = req.body;
    
    if (!valor || valor <= 0) {
        return res.status(400).json({ error: "Valor de pagamento inválido." });
    }

    const database = db();
    
    database.serialize(() => {
        // 1. Verifica nome do entregador para o histórico do caixa
        database.get("SELECT nome, saldo FROM Entregador WHERE id = ?", [id], (err, entregador) => {
            if (err || !entregador) return res.status(404).json({ error: "Entregador não encontrado." });
            
            if (entregador.saldo < valor) {
                return res.status(400).json({ error: "Saldo insuficiente para este pagamento." });
            }

            // 2. Registra o pagamento no histórico do entregador
            database.run("INSERT INTO HistoricoPagamentoEntregador (entregador_id, valor, descricao) VALUES (?, ?, ?)", [id, valor, descricao || null], function(errH) {
                if (errH) return res.status(500).json({ error: errH.message });

                // 3. Subtrai do saldo
                database.run("UPDATE Entregador SET saldo = saldo - ? WHERE id = ?", [valor, id], function(errU) {
                    if (errU) return res.status(500).json({ error: errU.message });

                    // 4. Lança no fluxo de caixa (Saída)
                    const descCaixa = descricao || `Pagamento de Repasse: ${entregador.nome}`;
                    database.run("INSERT INTO FluxoCaixa (tipo, valor, descricao) VALUES ('Saída', ?, ?)", [valor, descCaixa], function(errC) {
                        if (errC) console.error("Erro ao lançar saída no caixa:", errC);
                        
                        res.json({ message: "Pagamento realizado com sucesso e registrado no caixa!", novo_saldo: entregador.saldo - valor });
                    });
                });
            });
        });
    });
});

// 7. Ajuste Manual de Saldo
router.post('/:id/ajuste', ensureAdmin, (req, res) => {
    const { id } = req.params;
    const { valor, descricao } = req.body;
    
    if (typeof valor !== 'number' || isNaN(valor)) {
        return res.status(400).json({ error: "Valor numérico inválido para o ajuste." });
    }

    if (!descricao) {
        return res.status(400).json({ error: "A descrição do ajuste é obrigatória." });
    }

    const database = db();
    
    database.serialize(() => {
        database.get("SELECT nome, saldo FROM Entregador WHERE id = ?", [id], (err, entregador) => {
            if (err || !entregador) return res.status(404).json({ error: "Entregador não encontrado." });
            
            // Inserimos "-valor" pois a tabela de pagamentos representa saídas. 
            // Se o admin lançou um ajuste POSITIVO (ex: +5), o valor_bd = -5 (historico de saída negativo = entrada).
            const valorDb = -valor; 
            
            database.run("INSERT INTO HistoricoPagamentoEntregador (entregador_id, valor, descricao) VALUES (?, ?, ?)", [id, valorDb, descricao], function(errH) {
                if (errH) return res.status(500).json({ error: errH.message });

                // O valor bruto aumenta ou diminui o saldo real
                database.run("UPDATE Entregador SET saldo = saldo + ? WHERE id = ?", [valor, id], function(errU) {
                    if (errU) return res.status(500).json({ error: errU.message });
                    res.json({ message: "Ajuste de saldo realizado com sucesso!", novo_saldo: entregador.saldo + valor });
                });
            });
        });
    });
});

module.exports = router;
