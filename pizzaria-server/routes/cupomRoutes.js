// routes/cupomRoutes.js
const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { ensureAdmin } = require('../middleware/auth');
const { getAgoraSP } = require('../utils/dateUtils');

// -------------------------------------------------------
// POST /api/cupons/baixa-geral — Baixa FIFO (Global)
// -------------------------------------------------------
router.post('/baixa-geral', ensureAdmin, (req, res) => {
    const database = db();
    const { cliente_id, valor_pago, metodo_pagamento_id } = req.body;

    console.log(`[CUPOM] Iniciando baixa geral para cliente ${cliente_id}, Valor: ${valor_pago}`);

    if (!cliente_id) return res.status(400).json({ error: 'ID do cliente não informado.' });
    if (!valor_pago || parseFloat(valor_pago) <= 0) return res.status(400).json({ error: 'Informe um valor válido.' });
    if (!metodo_pagamento_id) return res.status(400).json({ error: 'Informe a forma de pagamento.' });

    const valorTotalRecebido = parseFloat(valor_pago);
    let saldoRestante = valorTotalRecebido;
    const dataAgora = getAgoraSP();

    database.all(
        `SELECT * FROM CupomPendente WHERE cliente_id = ? AND status = 'Pendente' ORDER BY data_criacao ASC`,
        [cliente_id],
        (err, cupons) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!cupons || cupons.length === 0) return res.status(200).json({ message: 'Nenhum débito pendente encontrado.', ok: true });

            const clienteNome = cupons[0].cliente_nome;
            
            try {
                // Motor síncrono sql.js: rodamos comando por comando.
                // Usamos BEGIN e COMMIT simplificados e síncronos.
                database.run("BEGIN");

                for (const cupom of cupons) {
                    if (saldoRestante <= 0) break;
                    const valorDebito = parseFloat(cupom.valor);

                    if (saldoRestante >= valorDebito) {
                        database.run(
                            `UPDATE CupomPendente SET status = 'Pago', metodo_baixa_id = ?, data_baixa = ?, valor = ? WHERE id = ?`,
                            [metodo_pagamento_id, dataAgora, valorDebito, cupom.id]
                        );
                        saldoRestante -= valorDebito;
                    } else {
                        const valorBaixa = saldoRestante;
                        const restante = parseFloat((valorDebito - valorBaixa).toFixed(2));
                        database.run(
                            `UPDATE CupomPendente SET status = 'Pago Parcial', metodo_baixa_id = ?, data_baixa = ?, valor = ? WHERE id = ?`,
                            [metodo_pagamento_id, dataAgora, valorBaixa, cupom.id]
                        );
                        database.run(
                            `INSERT INTO CupomPendente (pedido_id, cliente_id, cliente_nome, valor, valor_original, descricao, status) VALUES (?, ?, ?, ?, ?, ?, 'Pendente')`,
                            [cupom.pedido_id, cupom.cliente_id, cupom.cliente_nome, restante, restante, `${cupom.descricao || 'Débito'} (saldo restante)`]
                        );
                        saldoRestante = 0;
                    }
                }

                const descFluxo = `Recebimento Débitos — ${clienteNome}`;
                database.run(
                    `INSERT INTO FluxoCaixa (tipo, valor, metodo_pagamento_id, descricao, data_movimentacao) VALUES ('Entrada', ?, ?, ?, ?)`,
                    [valorTotalRecebido, metodo_pagamento_id, descFluxo, dataAgora]
                );

                database.run("COMMIT");
                console.log(`[CUPOM] Sucesso na baixa do cliente ${cliente_id}`);
                
                atualizarValorPendenteCliente(database, cliente_id, () => {
                    res.json({ message: `Recebimento de R$ ${valorTotalRecebido.toFixed(2)} processado com sucesso!` });
                });
            } catch (errLoop) {
                console.error("[CUPOM] Erro no loop de baixa:", errLoop.message);
                database.run("ROLLBACK");
                res.status(500).json({ error: "Erro ao processar pagamentos." });
            }
        }
    );
});

// -------------------------------------------------------
// GET /api/cupons — Lista cupons (com filtro de status)
// -------------------------------------------------------
router.get('/', ensureAdmin, (req, res) => {
    const database = db();
    const { status, cliente_id } = req.query; // 'Pendente', 'Pago', 'Pago Parcial', ou vazio (todos)

    let whereConditions = [];
    const params = [];

    if (status && status !== 'Todos') {
        whereConditions.push('cp.status = ?');
        params.push(status);
    }
    if (cliente_id) {
        whereConditions.push('cp.cliente_id = ?');
        params.push(cliente_id);
    }

    let whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const sql = `
        SELECT 
            cp.*,
            c.nome AS cliente_nome_cadastro,
            c.telefone AS cliente_telefone,
            p.tipo AS pedido_tipo,
            m.nome AS metodo_baixa_nome
        FROM CupomPendente cp
        LEFT JOIN Cliente c ON cp.cliente_id = c.id
        LEFT JOIN Pedido p ON cp.pedido_id = p.id
        LEFT JOIN ModosDePagamento m ON cp.metodo_baixa_id = m.id
        ${whereClause}
        ORDER BY cp.data_criacao DESC
    `;

    database.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// -------------------------------------------------------
// POST /api/cupons/:id/baixa — Dá baixa (total ou parcial)
// -------------------------------------------------------
router.post('/:id/baixa', ensureAdmin, (req, res) => {
    const database = db();
    const { id } = req.params;
    const { valor_pago, metodo_pagamento_id } = req.body;

    if (!valor_pago || parseFloat(valor_pago) <= 0) {
        return res.status(400).json({ error: 'Informe um valor válido para pagamento.' });
    }
    if (!metodo_pagamento_id) {
        return res.status(400).json({ error: 'Informe a forma de pagamento.' });
    }

    // Busca o cupom atual
    database.get('SELECT * FROM CupomPendente WHERE id = ? AND status IN (\'Pendente\', \'Pago Parcial\')', [id], (err, cupom) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!cupom) return res.status(404).json({ error: 'Cupom não encontrado ou já quitado.' });

        const valorPago = parseFloat(valor_pago);
        const valorRestante = parseFloat((cupom.valor - valorPago).toFixed(2));
        const dataAgora = getAgoraSP();

        // Valida se o valor pago não excede o valor em aberto
        if (valorPago > cupom.valor) {
            return res.status(400).json({ error: `Valor pago (R$${valorPago.toFixed(2)}) excede o valor em aberto (R$${cupom.valor.toFixed(2)}).` });
        }

        const isPagamentoParcial = valorRestante > 0.009; // margem de centavos
        const novoStatus = isPagamentoParcial ? 'Pago Parcial' : 'Pago';

        const descricaoCupom = cupom.descricao || `Pedido #${cupom.pedido_id}`;
        const descricaoFluxo = `Baixa Cupom — ${descricaoCupom} (${cupom.cliente_nome || 'Cliente'})`;

        // 1. Atualiza o cupom original (vira registro histórico do que foi pago agora)
        database.run(
            `UPDATE CupomPendente SET status = ?, metodo_baixa_id = ?, data_baixa = ?, valor = ? WHERE id = ?`,
            [novoStatus, metodo_pagamento_id, dataAgora, valorPago, id],
            function(errUp) {
                if (errUp) return res.status(500).json({ error: errUp.message });

                // 2. Insere entrada real no FluxoCaixa
                database.run(
                    `INSERT INTO FluxoCaixa (tipo, valor, metodo_pagamento_id, descricao, data_movimentacao) VALUES ('Entrada', ?, ?, ?, ?)`,
                    [valorPago, metodo_pagamento_id, descricaoFluxo, dataAgora],
                    function(errFC) {
                        if (errFC) return res.status(500).json({ error: errFC.message });

                        // 3. Se pagamento parcial: cria novo CupomPendente com o restante
                        if (isPagamentoParcial) {
                            database.run(
                                `INSERT INTO CupomPendente (pedido_id, cliente_id, cliente_nome, valor, valor_original, descricao, status) VALUES (?, ?, ?, ?, ?, ?, 'Pendente')`,
                                [cupom.pedido_id, cupom.cliente_id, cupom.cliente_nome, valorRestante, valorRestante, `${descricaoCupom} (saldo restante)`],
                                function(errNew) {
                                    if (errNew) return res.status(500).json({ error: errNew.message });

                                    // 4. Atualiza valor_pendente do cliente
                                    atualizarValorPendenteCliente(database, cupom.cliente_id, () => {
                                        res.json({
                                            message: `Baixa parcial realizada! R$${valorPago.toFixed(2)} recebidos. Novo cupom de R$${valorRestante.toFixed(2)} criado.`,
                                            valor_restante: valorRestante,
                                            novo_cupom_criado: true
                                        });
                                    });
                                }
                            );
                        } else {
                            // 4. Atualiza valor_pendente do cliente (pagamento total)
                            atualizarValorPendenteCliente(database, cupom.cliente_id, () => {
                                res.json({
                                    message: `Baixa total realizada! R$${valorPago.toFixed(2)} recebidos.`,
                                    valor_restante: 0,
                                    novo_cupom_criado: false
                                });
                            });
                        }
                    }
                );
            }
        );
    });
});

// Helper: recalcula e atualiza o valor_pendente do cliente
function atualizarValorPendenteCliente(database, cliente_id, callback) {
    if (!cliente_id) return callback();

    database.get(
        `SELECT COALESCE(SUM(valor), 0) AS total FROM CupomPendente WHERE cliente_id = ? AND status = 'Pendente'`,
        [cliente_id],
        (err, row) => {
            if (err) {
                console.error(`[CUPOM] Erro ao recalcular saldo do cliente ${cliente_id}:`, err.message);
                return callback(); // Continua para que a resposta seja enviada ao usuário
            }
            const total = (row && row.total) ? row.total : 0;
            database.run(
                `UPDATE Cliente SET valor_pendente = ? WHERE id = ?`,
                [total, cliente_id],
                (errUpd) => {
                    if (errUpd) console.error(`[CUPOM] Erro ao atualizar saldo na tabela Cliente:`, errUpd.message);
                    callback();
                }
            );
        }
    );
}

module.exports = router;
