const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { ensureAdmin } = require('../middleware/auth');
const { getAgoraSP } = require('../utils/dateUtils');

// --- 1. Listar todas as mesas (Simples) ---
router.get('/', (req, res) => {
    const database = db();
    database.all("SELECT * FROM Mesa ORDER BY numero", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// --- 2. Monitor do Salão (Status Real-time com Itens) ---
router.get('/status-salao', (req, res) => {
    const database = db();
    // Pega todas as mesas e o pedido sentinel (status 'Aberto') para saber se está ocupada
    const sqlMesas = `
        SELECT m.id, m.numero, p.id as pedido_id, p.status as pedido_status
        FROM Mesa m
        LEFT JOIN Pedido p ON m.id = p.mesa_id AND p.status = 'Aberto'
        ORDER BY m.numero`;

    database.all(sqlMesas, [], (err, mesas) => {
        if (err) return res.status(500).json({ error: err.message });

        // Busca TODOS os pedidos da sessão ativa das mesas (inclusive 'Servido' para histórico)
        const sqlPedidos = `
            SELECT p.id, p.mesa_id, p.status, p.valor_total, p.data_hora
            FROM Pedido p
            WHERE p.mesa_id IS NOT NULL
              AND p.status NOT IN ('Finalizado', 'Entregue/Concluído', 'Cancelado')
            ORDER BY p.data_hora ASC`;

        database.all(sqlPedidos, [], (err, todosPedidos) => {
            if (err) return res.status(500).json({ error: err.message });

            // Busca itens apenas de pedidos ativos das mesas
            const sqlItens = `
                SELECT ip.*, pr.nome AS produto_nome 
                FROM ItemPedido ip 
                LEFT JOIN Produto pr ON ip.produto_id = pr.id
                WHERE ip.pedido_id IN (
                    SELECT id FROM Pedido WHERE mesa_id IS NOT NULL
                    AND status NOT IN ('Finalizado', 'Entregue/Concluído', 'Cancelado')
                )`;

            database.all(sqlItens, [], (err, todosItens) => {
                if (err) return res.status(500).json({ error: err.message });

                const data = mesas.map(mesa => {
                    // Pedidos ativos desta mesa (inclui Pendente, Preparando, Pronto, Aberto)
                    const pedidosDaMesa = todosPedidos.filter(p => p.mesa_id === mesa.id);
                    // Total acumulado de todos os pedidos ativos
                    const total = pedidosDaMesa
                        .filter(p => p.status !== 'Aberto')
                        .reduce((acc, p) => acc + (p.valor_total || 0), 0);
                    // Itens de todos os pedidos ativos (para exibir na comanda)
                    const itensDaMesa = todosItens.filter(i =>
                        pedidosDaMesa.some(p => p.id === i.pedido_id)
                    );

                    return {
                        ...mesa,
                        itens: itensDaMesa,
                        total_acumulado: total,
                        pedidos: pedidosDaMesa.filter(p => p.status !== 'Aberto')
                    };
                });
                res.json({ data });
            });
        });
    });
});

// --- 3. Cadastrar Nova Mesa ---
router.post('/', ensureAdmin, (req, res) => {
    const { numero } = req.body;
    const database = db();
    database.run("INSERT INTO Mesa (numero) VALUES (?)", [numero], function(err) {
        if (err) return res.status(400).json({ error: "Mesa já cadastrada ou erro no banco." });
        res.status(201).json({ id: this.lastID, message: "Mesa criada!" });
    });
});

// --- 4. Excluir Mesa ---
router.delete('/:id', ensureAdmin, (req, res) => {
    const database = db();
    database.run("DELETE FROM Mesa WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Mesa removida." });
    });
});

// --- 5. Transferir Pedido de uma Mesa para Outra
router.post('/transferir', (req, res) => {
    console.log("📥 [POST] Transferência solicitada:", req.body); // Log para debug

    const { mesaOrigemId, mesaDestinoId } = req.body;
    const database = db();

    if (!mesaOrigemId || !mesaDestinoId) {
        return res.status(400).json({ error: "IDs das mesas de origem e destino são obrigatórios." });
    }

    // 1. Verificar se a mesa de origem tem pedido aberto
    const sqlCheckOrigem = "SELECT id FROM Pedido WHERE mesa_id = ? AND status != 'Finalizado'";
    
    database.get(sqlCheckOrigem, [mesaOrigemId], (err, pedido) => {
        if (err) return res.status(500).json({ error: "Erro ao verificar origem: " + err.message });
        if (!pedido) return res.status(400).json({ error: "A mesa de origem não tem conta aberta." });

        // 2. Verificar se a mesa de destino está LIVRE
        const sqlCheckDestino = "SELECT id FROM Pedido WHERE mesa_id = ? AND status != 'Finalizado'";
        
        database.get(sqlCheckDestino, [mesaDestinoId], (err, ocupada) => {
            if (err) return res.status(500).json({ error: "Erro ao verificar destino." });
            
            // Se encontrou algum pedido na mesa destino, ela está ocupada!
            if (ocupada) {
                return res.status(400).json({ error: "A mesa de destino já está ocupada!" });
            }

            // 3. Tudo certo? Executa a transferência
            const sqlUpdate = "UPDATE Pedido SET mesa_id = ? WHERE id = ?";
            
            database.run(sqlUpdate, [mesaDestinoId, pedido.id], function(err) {
                if (err) return res.status(500).json({ error: "Erro SQL ao transferir: " + err.message });
                
                console.log(`✅ Pedido ${pedido.id} movido da Mesa ${mesaOrigemId} para ${mesaDestinoId}`);
                res.json({ message: "Mesa transferida com sucesso!" });
            });
        });
    });
});

// --- 6. Abrir mesa (cria sentinel) ---
router.post('/abrir-conta', (req, res) => {
    const { mesa_id } = req.body;
    const database = db();
    // Verifica se já existe um sentinel
    database.get("SELECT id FROM Pedido WHERE mesa_id = ? AND status = 'Aberto'", [mesa_id], (err, existing) => {
        if (existing) return res.status(201).json({ pedido_id: existing.id, message: "Conta já aberta!" });
        const sql = `INSERT INTO Pedido (mesa_id, valor_total, status) VALUES (?, 0, 'Aberto')`;
        database.run(sql, [mesa_id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ pedido_id: this.lastID, message: "Conta aberta com sucesso!" });
        });
    });
});

// --- 7. Fechar conta da mesa (finaliza todos os pedidos ativos) ---
router.post('/fechar-conta', (req, res) => {
    const { mesa_id, metodo_pagamento_id, valor_total } = req.body;
    const database = db();

    if (!mesa_id || !metodo_pagamento_id || valor_total === undefined) {
        return res.status(400).json({ error: "Dados incompletos para fechar a conta." });
    }

    // 1. Finaliza todos os pedidos da mesa (inclusive 'Servido')
    const sqlUpdate = `
        UPDATE Pedido 
        SET status = 'Entregue/Concluído', modo_pagamento_id = ?
        WHERE mesa_id = ? AND status NOT IN ('Finalizado', 'Entregue/Concluído')
    `;
    database.run(sqlUpdate, [metodo_pagamento_id, mesa_id], function(err) {
        if (err) return res.status(500).json({ error: "Erro ao fechar pedidos: " + err.message });

        // 2. Registra no FluxoCaixa
        const descricao = `Fechamento Mesa ${mesa_id}`;
        database.run(
            "INSERT INTO FluxoCaixa (tipo, valor, metodo_pagamento_id, descricao, data_movimentacao) VALUES ('Entrada', ?, ?, ?, ?)",
            [valor_total, metodo_pagamento_id, descricao, getAgoraSP()],
            function(err) {
                if (err) console.error("Erro ao lançar no caixa:", err);
                res.json({ message: "Conta fechada e registrada no caixa!" });
            }
        );
    });
});

// Rota: POST /api/pedidos/adicionar-item
router.post('/adicionar-item', (req, res) => {
    const { pedido_id, produto_id, quantidade, valor } = req.body;
    const database = db();

    // 1. Primeiro, buscamos o nome do produto para salvar no histórico do item
    database.get("SELECT nome FROM Produto WHERE id = ?", [produto_id], (err, produto) => {
        if (err || !produto) return res.status(404).json({ error: "Produto não encontrado." });

        // 2. Inserimos o item na tabela ItemPedido
        const sqlItem = `
            INSERT INTO ItemPedido (pedido_id, produto_id, quantidade, valor, nome) 
            VALUES (?, ?, ?, ?, ?)
        `;
        
        database.run(sqlItem, [pedido_id, produto_id, quantidade, valor, produto.nome], function(err) {
            if (err) return res.status(500).json({ error: "Erro ao inserir item." });

            // 3. Atualizamos o valor_total do Pedido (soma do que já existe + novo item)
            const sqlUpdatePedido = `
                UPDATE Pedido 
                SET valor_total = valor_total + (? * ?) 
                WHERE id = ?
            `;
            
            database.run(sqlUpdatePedido, [quantidade, valor, pedido_id], (err) => {
                if (err) return res.status(500).json({ error: "Erro ao atualizar total do pedido." });
                
                res.status(201).json({ message: "Item adicionado com sucesso!" });
            });
        });
    });
});

// Rota POST: Finalizar pedido
router.post('/finalizar-pedido', async (req, res) => {
    const { pedido_id, mesa_id, valor_total, metodo_pagamento_id, subtotal, taxa_servico } = req.body;
    const database = db();

    database.serialize(() => {
        // 1. Finaliza o Pedido
        database.run(
            "UPDATE Pedido SET status = 'Finalizado', valor_total = ? WHERE id = ?",
            [valor_total, pedido_id]
        );

        // 2. Registra no Fluxo de Caixa como 'Entrada'
        const descricao = `Venda Mesa ${mesa_id} - Pedido #${pedido_id}`;
        database.run(
            "INSERT INTO FluxoCaixa (tipo, valor, metodo_pagamento_id, descricao) VALUES (?, ?, ?, ?)",
            ['Entrada', valor_total, metodo_pagamento_id, descricao],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "Pedido finalizado e registrado no caixa!" });
            }
        );
    });
});

module.exports = router;