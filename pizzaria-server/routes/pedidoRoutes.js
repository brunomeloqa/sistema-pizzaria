// routes/pedidoRoutes.js
const express = require('express');
const router = express.Router();
const { db } = require('../database'); 
const printQueue = require('../printQueue'); 
const { ensureAdmin } = require('../middleware/auth'); 
const { getAgoraSP, getNowSP } = require('../utils/dateUtils');
function calcularTotal(itens) {
    if (!Array.isArray(itens) || itens.length === 0) return 0;
    return itens.reduce(function(total, item) {
        var valor = Number(item.valor || item.price || 0) || 0;
        var qtd = Number(item.quantidade || item.qtd || 0) || 0;
        return total + (valor * qtd);
    }, 0);
}

function formatToSqlDate(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

function getStartOfWeek() {
    var now = getNowSP();
    var dayOfWeek = now.getDay();
    var diff = now.getDate() - dayOfWeek;
    var startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    return formatToSqlDate(startOfWeek);
}

function getToday() {
    var now = getNowSP();
    now.setHours(0, 0, 0, 0);
    return formatToSqlDate(now);
}

function getStartOfMonth() {
    var now = getNowSP();
    var startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    return formatToSqlDate(startOfMonth);
}

// ----------------------------------------------------------------------
// Rota 1: [POST] /pedidos - Cria um novo pedido e seus itens
// ----------------------------------------------------------------------
router.post('/', ensureAdmin, (req, res) => {
    var database = db();
    var body = req.body || {};
    var tipo = body.tipo || 'Balcão';
    var cliente_id = body.cliente_id || null;
    var modo_pagamento_id = body.modo_pagamento_id;
    var observacao = body.observacao;
    var itens = Array.isArray(body.itens) ? body.itens : [];
    var endereco_entrega = body.endereco_entrega;
    var complemento_entrega = body.complemento_entrega;
    var mesa_id = body.mesa_id || null;
    var nome_cliente = body.nome_cliente || null;
    
    if (itens.length === 0) {
        return res.status(400).json({ error: "É necessário pelo menos um item no pedido." });
    }
    if (tipo === 'Delivery' && !cliente_id) {
        return res.status(400).json({ error: "Para Delivery é necessário informar um cliente." });
    }

    var parent_id = body.parent_id || null;
    var valor_total = body.valor_total || calcularTotal(itens);
    var desconto = body.desconto || 0;
    var taxa_servico = body.taxa_servico !== undefined ? body.taxa_servico : 10;
    var data_hora = getAgoraSP();
    var pagamentos = Array.isArray(body.pagamentos) ? body.pagamentos : [];
    
    // Todo novo pedido deve iniciar como 'Pendente' para aparecer no Monitor de Cozinha,
    // mesmo que já tenha sido pago (Split Payment).
    var statusInicial = 'Pendente';

    try {
        var sqlPedido = "INSERT INTO Pedido (cliente_id, nome_cliente, tipo, modo_pagamento_id, observacao, data_hora, status, valor_total, desconto, taxa_servico_padrao, endereco_entrega, complemento_entrega, mesa_id, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        database.run(sqlPedido, [
            cliente_id || null, 
            nome_cliente || null,
            tipo || 'Balcão',
            pagamentos.length > 0 ? pagamentos[0].metodo_pagamento_id : (modo_pagamento_id || null), 
            observacao || null,        
            data_hora,                 
            statusInicial,                
            valor_total,
            desconto,
            taxa_servico,
            endereco_entrega || null,   
            complemento_entrega || null,
            mesa_id || null,
            parent_id || null
        ], function(err) {
            if (err) {
                console.error("Erro ao criar pedido:", err && err.message ? err.message : err);
                return res.status(500).json({ error: "Erro ao criar pedido: " + (err && err.message ? err.message : String(err)) });
            }
            
            var pedido_id = (this && this.lastID) ? this.lastID : null;
            // fallback: tentar obter id via SELECT MAX(id) (menos ideal, só se lastID não disponível)
            if (!pedido_id) {
                try {
                    // tentar SELECT para obter último id inserido (por data_hora)
                    database.get("SELECT id FROM Pedido WHERE data_hora = ? ORDER BY id DESC LIMIT 1", [data_hora], function(selectErr, row) {
                        if (selectErr) {
                            console.error("Erro ao obter pedido_id fallback:", selectErr);
                            // continua mesmo sem id
                        } else if (row && row.id) {
                            pedido_id = row.id;
                        }

                        inserirItensEPersistir();
                    });
                } catch (e) {
                    console.error("Erro fallback obter pedido_id:", e);
                    inserirItensEPersistir();
                }
            } else {
                inserirItensEPersistir();
            }

            function inserirItensEPersistir() {
                if (!pedido_id) {
                    // mesmo sem id tentamos inserir itens com null (não recomendado) — retornar erro
                    console.error("Pedido criado mas não foi possível obter pedido_id.");
                    return res.status(500).json({ error: 'Pedido criado, mas não foi possível obter ID para inserir itens.' });
                }

                var sucessos = 0;
                var erros = 0;

                if (!Array.isArray(itens) || itens.length === 0) {
                    // sem itens, responde
                    return res.status(201).json({ message: "Pedido criado com sucesso!", pedido_id: pedido_id, valor_total: valor_total, desconto: desconto });
                }

                itens.forEach(function(item, index) {
                    var sqlItem = "INSERT INTO ItemPedido (pedido_id, produto_id, quantidade, observacao, nome, valor) VALUES (?, ?, ?, ?, ?, ?)";
                    database.run(sqlItem, [
                        pedido_id, 
                        item.produto_id || null, 
                        item.quantidade || 0, 
                        item.observacao || null, 
                        item.nome || null, 
                        item.valor || 0
                    ], function(itemErr) {
                        if (itemErr) {
                            erros++;
                            console.error("Erro ao inserir item:", itemErr && itemErr.message ? itemErr.message : itemErr);
                        } else {
                            sucessos++;
                        }
                        
                        if (sucessos + erros === itens.length) {
                            if (erros === 0) {
                                // Processar PAGAMENTOS se existirem
                                if (pagamentos.length > 0) {
                                    const descricaoBase = tipo === 'Delivery' ? `Delivery (Pedido #${pedido_id})` : `Balcão (Pedido #${pedido_id})`;
                                    const clienteNome = nome_cliente || body.cliente_nome || null;
                                    
                                    // Busca is_cupom de cada método antes de registrar
                                    let processados = 0;
                                    pagamentos.forEach(pg => {
                                        database.get(
                                            'SELECT is_cupom FROM ModosDePagamento WHERE id = ?',
                                            [pg.metodo_pagamento_id],
                                            (errM, metodo) => {
                                                processados++;
                                                if (!errM && metodo && Number(metodo.is_cupom) === 1) {
                                                    // VALIDAÇÃO: Cupom só para Delivery
                                                    if (tipo !== 'Delivery') {
                                                        console.error(`[Pedido] Bloqueado: Tentativa de usar Cupom em pedido ${tipo}`);
                                                        return;
                                                    }

                                                    // Pagamento diferido (Pendura): NÃO ENTRA NO FLUXO DE CAIXA
                                                    database.run(
                                                        `INSERT INTO CupomPendente (pedido_id, cliente_id, cliente_nome, valor, valor_original, descricao, status) VALUES (?, ?, ?, ?, ?, ?, 'Pendente')`,
                                                        [pedido_id, cliente_id || null, clienteNome, pg.valor, pg.valor, descricaoBase]
                                                    );
                                                    if (cliente_id) {
                                                        database.run(
                                                            `UPDATE Cliente SET valor_pendente = COALESCE(valor_pendente, 0) + ? WHERE id = ?`,
                                                            [pg.valor, cliente_id]
                                                        );
                                                    }
                                                } else {
                                                    // Pagamento normal: FluxoCaixa
                                                    database.run(
                                                        "INSERT INTO PedidoPagamento (pedido_id, metodo_pagamento_id, valor) VALUES (?, ?, ?)",
                                                        [pedido_id, pg.metodo_pagamento_id, pg.valor]
                                                    );
                                                    database.run(
                                                        "INSERT INTO FluxoCaixa (tipo, valor, metodo_pagamento_id, descricao, data_movimentacao) VALUES ('Entrada', ?, ?, ?, ?)",
                                                        [pg.valor, pg.metodo_pagamento_id, `Recebimento ${descricaoBase}`, getAgoraSP()]
                                                    );
                                                }
                                            }
                                        );
                                    });
                                }

                                try {
                                    if (printQueue && typeof printQueue.addJob === 'function') printQueue.addJob(pedido_id);
                                } catch (qErr) {
                                    console.error("Erro ao adicionar na printQueue:", qErr);
                                }
                                return res.status(201).json({ 
                                    message: "Pedido criado com sucesso!", 
                                    pedido_id: pedido_id, 
                                    valor_total: valor_total,
                                    desconto: desconto
                                });
                            } else {
                                return res.status(500).json({ error: String(erros) + " item(ns) falharam ao inserir." });
                            }
                        }
                    });
                });
            }
        });
    } catch (error) {
        console.error("Erro:", error);
        res.status(500).json({ error: String(error) });
    }
});

// ----------------------------------------------------------------------
// Rota 2: [GET] /pedidos/pendentes - Lista pedidos em aberto
// ----------------------------------------------------------------------
router.get('/pendentes', ensureAdmin, (req, res) => {
    var database = db();
    var sql = `
        SELECT 
            p.id, p.status, p.valor_total, p.desconto, p.nome_cliente, p.tipo, c.nome AS cliente_nome, c.endereco AS cliente_endereco_original, c.numero AS cliente_numero, p.data_hora, p.endereco_entrega, p.complemento_entrega, p.observacao, p.mesa_id, m.numero AS mesa_numero,
            (SELECT COUNT(*) FROM PedidoPagamento pp WHERE pp.pedido_id = p.id) as total_pagamentos
        FROM Pedido p 
        LEFT JOIN Cliente c ON p.cliente_id = c.id 
        LEFT JOIN Mesa m ON p.mesa_id = m.id
        WHERE p.status IN ('Pendente', 'Preparando', 'Pronto para Entrega/Retirada') 
        ORDER BY p.id DESC`;

    database.all(sql, [], function(err, rows) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Lista de pedidos para Kanban', data: rows });
    });
});

// ----------------------------------------------------------------------
// Rota 3: [PUT] /pedidos/:id/status - Atualiza o status de um pedido
// ----------------------------------------------------------------------
router.put('/:id/status', ensureAdmin, (req, res) => {
    var database = db();
    var id = req.params.id;
    var status = req.body && req.body.status;

    var statusValidos = ['Pendente', 'Preparando', 'Pronto para Entrega/Retirada', 'Entregue/Concluído', 'Servido', 'Cancelado'];

    if (!status || statusValidos.indexOf(status) === -1) {
        return res.status(400).json({ error: "Status inválido", validos: statusValidos });
    }

    database.run("UPDATE Pedido SET status = ? WHERE id = ?", [status, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (!this || this.changes === 0) {
            return res.status(404).json({ message: "Pedido não encontrado." });
        }

        if (status === 'Cancelado') {
            database.all("SELECT cliente_id, valor FROM CupomPendente WHERE pedido_id = ?", [id], (err, cupons) => {
                if (!err && cupons) {
                    cupons.forEach(cupom => {
                        if (cupom.cliente_id) {
                            database.run("UPDATE Cliente SET valor_pendente = MAX(0, COALESCE(valor_pendente, 0) - ?) WHERE id = ?", [cupom.valor, cupom.cliente_id]);
                        }
                    });
                }
                database.run("DELETE FROM CupomPendente WHERE pedido_id = ?", [id]);
            });

            database.run("DELETE FROM PedidoPagamento WHERE pedido_id = ?", [id]);
            database.run("DELETE FROM FluxoCaixa WHERE descricao LIKE '%Pedido #' || ? || ')%'", [id]);
        }
        
        res.json({
            message: "Status do pedido " + id + " atualizado para: " + status,
            pedido_id: id,
            novo_status: status
        });
    });
});

// ----------------------------------------------------------------------
// Rota 4: [GET] /pedidos/:id/detail - Busca TODOS os detalhes para a VISUALIZAÇÃO/IMPRESSÃO
// ----------------------------------------------------------------------
router.get('/:id/detail', ensureAdmin, (req, res) => {
    var database = db();
    var id = req.params.id;

    var sqlDetail = `
        SELECT 
            p.*, 
            c.nome AS cliente_nome, 
            c.telefone AS cliente_telefone,
            c.celular AS cliente_celular,
            c.endereco AS cliente_endereco,
            c.numero AS cliente_numero,
            c.bairro AS cliente_bairro,
            c.CEP AS cliente_cep,
            c.complemento AS cliente_complemento,
            c.observacao AS cliente_observacao,
            m.nome AS modo_pagamento_nome
        FROM Pedido p 
        LEFT JOIN Cliente c ON p.cliente_id = c.id 
        LEFT JOIN ModosDePagamento m ON p.modo_pagamento_id = m.id
        WHERE p.id = ?
    `;

    database.get(sqlDetail, [id], function(err, pedido) {
        if (err) {
            console.error('❌ Erro ao buscar pedido detail:', err);
            return res.status(500).json({ error: err.message });
        }
        if (!pedido) {
            console.log('❌ Pedido não encontrado para id:', id);
            return res.status(404).json({ error: 'Pedido não encontrado.' });
        }

        console.log('✅ Pedido encontrado:', pedido);

        var sqlItems = "\n            SELECT nome, valor, quantidade, observacao\n            FROM ItemPedido\n            WHERE pedido_id = ? OR pedido_id IN (SELECT id FROM Pedido WHERE parent_id = ?)\n        ";

        database.all(sqlItems, [id, id], function(err, itens) {
            if (err) {
                console.error('❌ Erro ao buscar itens do pedido:', err);
                return res.status(500).json({ error: err.message });
            }

            console.log('✅ Itens encontrados para pedido', id, ':', itens);
            
            // Buscar múltiplos pagamentos se existirem
            const sqlPagamentos = `
                SELECT pp.*, m.nome as metodo_nome 
                FROM PedidoPagamento pp
                JOIN ModosDePagamento m ON pp.metodo_pagamento_id = m.id
                WHERE pp.pedido_id = ?
            `;
            
            database.all(sqlPagamentos, [id], (errPg, pagamentos) => {
                if (errPg) console.error("Erro ao buscar pagamentos do pedido:", errPg);

                pedido.itens = itens || [];
                pedido.pagamentos = pagamentos || [];
                
                console.log('✅ Pedido final com itens e pagamentos:', pedido);
                res.json({ data: pedido });
            });        });
    });
});

// Helper: gera o filtro de data SQL baseado no periodo
const filtroData = (query, campo = 'p.data_hora') => {
    const { periodo, data_inicio, data_fim } = query;
    if (periodo === 'dia')    return `AND date(${campo}, 'localtime') = date('now', 'localtime')`;
    if (periodo === 'semana') return `AND ${campo} >= datetime('now', 'localtime', '-7 days')`;
    if (periodo === 'mes')    return `AND ${campo} >= datetime('now', 'localtime', '-30 days')`;
    if (periodo === 'custom' && data_inicio && data_fim) {
        return `AND date(${campo}, 'localtime') BETWEEN '${data_inicio}' AND '${data_fim}'`;
    }
    return ''; // sem filtro = tudo
};

// Rota: Itens mais vendidos
router.get('/relatorios/mais-vendidos', ensureAdmin, (req, res) => {
    const database = db();
    const { periodo } = req.query;
    const sql = `
        SELECT ip.nome, SUM(ip.quantidade) AS total_vendido
        FROM ItemPedido ip
        JOIN Pedido p ON ip.pedido_id = p.id
        LEFT JOIN Produto pr ON ip.produto_id = pr.id
        WHERE p.status IN ('Entregue/Concluído', 'Finalizado')
          AND (ip.nome NOT LIKE 'Pizza%')
          AND (pr.is_taxa IS NULL OR pr.is_taxa = 0)
          ${filtroData(req.query)}
        GROUP BY ip.nome
        ORDER BY total_vendido DESC
        LIMIT 15
    `;
    database.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// Rota: Pizzas por dia
router.get('/relatorios/pizzas-por-dia', ensureAdmin, (req, res) => {
    const database = db();
    const { periodo } = req.query;
    // Agrupa a qtd de pizzas pelo dia
    const sql = `
        SELECT 
            strftime('%Y-%m-%d', p.data_hora, 'localtime') AS data,
            SUM(ip.quantidade) AS total_pizzas
        FROM ItemPedido ip
        JOIN Pedido p ON ip.pedido_id = p.id
        WHERE ip.nome LIKE 'Pizza%'
          AND p.status IN ('Entregue/Concluído', 'Finalizado')
          ${filtroData(req.query)}
        GROUP BY data
        ORDER BY data DESC
        LIMIT 30
    `;
    database.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// Rota: Pizzas por tamanho
router.get('/relatorios/pizzas-por-tamanho', ensureAdmin, (req, res) => {
    const database = db();
    const { periodo } = req.query;
    // Categoriza "Grande" e "Broto" via nome do ItemPedido
    const sql = `
        SELECT 
            CASE 
                WHEN ip.nome LIKE '%Broto%' THEN 'Broto'
                WHEN ip.nome LIKE '%Média%' THEN 'Média'
                WHEN ip.nome LIKE '%Grande%' THEN 'Grande'
                ELSE 'Outro'
            END AS tamanho,
            SUM(ip.quantidade) AS total_pizzas
        FROM ItemPedido ip
        JOIN Pedido p ON ip.pedido_id = p.id
        WHERE ip.nome LIKE 'Pizza%'
          AND p.status IN ('Entregue/Concluído', 'Finalizado')
          ${filtroData(req.query)}
        GROUP BY tamanho
        ORDER BY total_pizzas DESC
    `;
    database.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// Rota: Sabores de pizza mais vendidos
router.get('/relatorios/sabores-pizza', ensureAdmin, (req, res) => {
    const database = db();
    const { periodo } = req.query;
    // Extrai os sabores do campo nome (ex: "Pizza Grande (Calabresa / Mussarela)")
    const sql = `
        SELECT ip.nome AS sabor_raw, SUM(ip.quantidade) AS total_vendido
        FROM ItemPedido ip
        JOIN Pedido p ON ip.pedido_id = p.id
        WHERE p.status IN ('Entregue/Concluído', 'Finalizado')
          AND ip.nome LIKE 'Pizza%'
          ${filtroData(req.query)}
        GROUP BY ip.nome
        ORDER BY total_vendido DESC
        LIMIT 15
    `;
    database.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // Expande sabores compostos (ex: "Calabresa / Mussarela" -> 2 sabores)
        const mapasSabores = {};
        rows.forEach(row => {
            const match = row.sabor_raw.match(/\((.+)\)/);
            if (match) {
                const sabores = match[1].split('/').map(s => s.trim());
                sabores.forEach(s => {
                    mapasSabores[s] = (mapasSabores[s] || 0) + row.total_vendido;
                });
            }
        });
        const resultado = Object.entries(mapasSabores)
            .map(([nome, total]) => ({ nome, total_vendido: total }))
            .sort((a, b) => b.total_vendido - a.total_vendido)
            .slice(0, 10);
        res.json({ data: resultado });
    });
});

// Rota: Bairros com mais pedidos
router.get('/relatorios/bairros', ensureAdmin, (req, res) => {
    const database = db();
    const { periodo } = req.query;
    const sql = `
        SELECT
            COALESCE(NULLIF(TRIM(cl.bairro), ''), 'Não informado') AS bairro,
            COUNT(p.id) AS total_pedidos,
            SUM(p.valor_total) AS receita_total,
            SUM(IFNULL(p.desconto, 0)) AS total_descontos
        FROM Pedido p
        JOIN Cliente cl ON p.cliente_id = cl.id
        WHERE p.status IN ('Entregue/Concluído', 'Finalizado')
          AND p.cliente_id IS NOT NULL
          ${filtroData(req.query)}
        GROUP BY bairro
        ORDER BY total_pedidos DESC
        LIMIT 10
    `;
    database.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// Rota: Pedidos por tipo de atendimento
router.get('/relatorios/tipo-atendimento', ensureAdmin, (req, res) => {
    const database = db();
    const { periodo } = req.query;
    const sql = `
        SELECT
            CASE
                WHEN p.mesa_id IS NOT NULL THEN 'Mesa'
                WHEN p.cliente_id IS NOT NULL THEN 'Delivery'
                ELSE 'Balcão'
            END AS tipo,
            COUNT(*) AS total_pedidos,
            SUM(p.valor_total) AS receita_total,
            SUM(CAST(IFNULL(p.desconto, 0) AS REAL)) AS total_descontos
        FROM Pedido p
        WHERE p.status IN ('Entregue/Concluído', 'Finalizado')
          ${filtroData(req.query)}
        GROUP BY tipo
        ORDER BY total_pedidos DESC
    `;
    database.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// Rota: Horários de pico
router.get('/relatorios/horarios', ensureAdmin, (req, res) => {
    const database = db();
    const { periodo } = req.query;
    const sql = `
        SELECT
            CAST(strftime('%H', p.data_hora, 'localtime') AS INTEGER) AS hora,
            COUNT(*) AS total_pedidos
        FROM Pedido p
        WHERE p.status IN ('Entregue/Concluído', 'Finalizado') ${filtroData(req.query)}
        GROUP BY hora
        ORDER BY hora ASC
    `;
    database.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// Rota: Entregas por entregador
router.get('/relatorios/entregadores', ensureAdmin, (req, res) => {
    const database = db();
    res.json({ data: [] }); // placeholder - usa dados da tabela Entregador diretamente
});

// Rota: Modos de Pagamento
router.get('/relatorios/modo-pagamento', ensureAdmin, (req, res) => {
    const database = db();
    const sql = `
        SELECT m.nome, SUM(pp.valor) AS total_recebido
        FROM PedidoPagamento pp
        JOIN ModosDePagamento m ON pp.metodo_pagamento_id = m.id
        JOIN Pedido p ON pp.pedido_id = p.id
        WHERE p.status IN ('Entregue/Concluído', 'Finalizado')
          ${filtroData(req.query)}
        GROUP BY m.nome
        ORDER BY total_recebido DESC
    `;
    database.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// Rota: semanais (legado - mantido por compatibilidade)
router.get('/relatorios/semanais', ensureAdmin, (req, res) => {
    const database = db();
    const sql = `
        SELECT strftime('%Y-%m-%d', p.data_hora) AS data,
            COUNT(*) AS total_pedidos, SUM(p.valor_total) AS receita_total
        FROM Pedido p WHERE p.data_hora >= date('now', 'weekday 0', '-6 days')
        GROUP BY data ORDER BY data DESC
    `;
    database.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// Rota legado por-perfil
router.get('/relatorios/por-perfil', ensureAdmin, (req, res) => {
    const database = db();
    const sql = `SELECT p.status, COUNT(*) AS total_pedidos, SUM(p.valor_total) AS receita_total FROM Pedido p GROUP BY p.status`;
    database.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// ----------------------------------------------------------------------
// Rota 9: [GET] /pedidos - Lista todos os pedidos
// ----------------------------------------------------------------------
router.get('/', ensureAdmin, (req, res) => {
    const database = db();
    const sql = `
        SELECT p.id, p.status, p.valor_total, p.desconto, p.nome_cliente, p.tipo, p.cliente_id,
               c.nome AS cliente_nome, c.endereco AS cliente_endereco_original, c.numero AS cliente_numero,
               p.data_hora, p.endereco_entrega, p.complemento_entrega,
               p.observacao, p.mesa_id, m.numero AS mesa_numero,
               (SELECT COUNT(*) FROM PedidoPagamento pp WHERE pp.pedido_id = p.id) as total_pagamentos
        FROM Pedido p 
        LEFT JOIN Cliente c ON p.cliente_id = c.id 
        LEFT JOIN Mesa m ON p.mesa_id = m.id
        ORDER BY p.data_hora DESC
    `;

    database.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Erro ao listar pedidos:", err.message);
            return res.status(500).json({ error: 'Erro interno do servidor.' });
        }
        res.json({ message: 'Lista de todos os pedidos', data: rows });
    });
});

// ----------------------------------------------------------------------
// Rota 5: [DELETE] /pedidos/limpeza - Limpa todos os pedidos e itens
// ----------------------------------------------------------------------
router.delete('/limpeza', ensureAdmin, (req, res) => {
    const database = db();

    try {
        database.serialize(() => {
            database.run('DELETE FROM ItemPedido', (err) => {
                if (err) {
                    console.error('Erro ao limpar itens de pedidos:', err.message);
                    return res.status(500).json({ error: 'Erro ao limpar itens de pedidos.' });
                }
            });

            database.run('DELETE FROM Pedido', (err) => {
                if (err) {
                    console.error('Erro ao limpar pedidos:', err.message);
                    return res.status(500).json({ error: 'Erro ao limpar pedidos.' });
                }

                res.json({ message: 'Pedidos e itens limpos com sucesso!' });
            });
        });
    } catch (error) {
        console.error('Erro ao executar limpeza:', error.message);
        res.status(500).json({ error: 'Erro interno ao executar limpeza.' });
    }
});

// Rota para adicionar item à mesa (ou qualquer pedido)
router.post('/adicionar-item', (req, res) => {
    // --- DEBUG: VAMOS VER O QUE O FRONT ESTÁ MANDANDO ---
    console.log("📥 [POST /adicionar-item] Body recebido:", req.body);
    
    const { pedido_id, produto_id, quantidade, valor, nome, observacao } = req.body;

    // Validação reforçada
    if (!pedido_id) {
        console.error("❌ Erro: pedido_id ausente.");
        return res.status(400).json({ error: "ID do Pedido é obrigatório." });
    }
    if (!produto_id && !nome) {
        console.error("❌ Erro: produto_id ou nome ausente.");
        return res.status(400).json({ error: "ID do Produto ou Nome é obrigatório." });
    }

    const database = db();

    // 1. Inserir o item
    const sqlItem = `INSERT INTO ItemPedido (pedido_id, produto_id, quantidade, valor, nome, observacao) VALUES (?, ?, ?, ?, ?, ?)`;
    
    database.run(sqlItem, [pedido_id, produto_id || null, quantidade || 1, valor, nome || null, observacao || null], function(err) {
        if (err) {
            console.error("❌ Erro SQLite ao inserir:", err.message);
            return res.status(500).json({ error: err.message });
        }

        // 2. Atualizar total
        const sqlUpdateTotal = `UPDATE Pedido SET valor_total = valor_total + (? * ?) WHERE id = ?`;
        
        database.run(sqlUpdateTotal, [quantidade || 1, valor, pedido_id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            
            console.log("✅ Item adicionado com sucesso!");
            res.status(201).json({ message: "Item adicionado!" });
        });
    });
});

//2. Remover item
router.delete('/remover-item/:id', (req, res) => {
    const { id } = req.params;
    const database = db();
    database.run("DELETE FROM ItemPedido WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Item removido" });
    });
});

// --- ROTA DE FINALIZAR PEDIDO (Adicione isto) ---
router.post('/finalizar-pedido', (req, res) => {
    const { pedido_id, mesa_id, valor_total, desconto, modo_pagamento_id, entregador_id, pagamentos, pessoas_mesa } = req.body;
    const metodo_pagamento_id_single = modo_pagamento_id || req.body.metodo_pagamento_id;
    const database = db();

    // Validação básica
    if (!pedido_id || !valor_total) {
        return res.status(400).json({ error: "Dados incompletos para finalizar." });
    }

    // Buscamos se já existem pagamentos para esse pedido
    // se existirem, permitimos listaPagamentos ser vazia se não informada
    database.serialize(() => {
        const sqlCheck = "SELECT COUNT(*) as pagos FROM PedidoPagamento WHERE pedido_id = ?";
        database.get(sqlCheck, [pedido_id], (errCheck, row) => {
            let listaPagamentos = [];
            if (Array.isArray(pagamentos) && pagamentos.length > 0) {
                listaPagamentos = pagamentos;
            } else if (metodo_pagamento_id_single) {
                listaPagamentos = [{ metodo_pagamento_id: metodo_pagamento_id_single, valor: valor_total }];
            } else if (row && row.pagos > 0) {
                // Já está pago, permitimos continuar sem novos pagamentos
                listaPagamentos = [];
            } else {
                return res.status(400).json({ error: "Informe ao menos uma forma de pagamento." });
            }

            // 1. Atualiza o status do Pedido para 'Entregue/Concluído'
            // O modo_pagamento_id principal será do primeiro pagamento novo ou do que já estava no banco
            const sqlUpdatePedido = `
                UPDATE Pedido 
                SET status = 'Entregue/Concluído', valor_total = ?, desconto = COALESCE(?, desconto), pessoas_mesa = ?
                WHERE id = ?
            `;
            
            database.run(sqlUpdatePedido, [valor_total, desconto !== undefined ? desconto : null, pessoas_mesa || 1, pedido_id], function(err) {
                if (err) {
                    return res.status(500).json({ error: "Erro ao fechar pedido: " + err.message });
                }

                // Se pertencente a uma mesa, finalizar TAMBÉM os outros pedidos parciais (cozinha) dessa mesma mesa
                if (mesa_id) {
                    database.run(`UPDATE Pedido SET status = 'Entregue/Concluído' WHERE mesa_id = ? AND status NOT IN ('Finalizado', 'Entregue/Concluído', 'Cancelado')`, [mesa_id]);
                }

                // 2. Busca informações do cliente do pedido para garantir CupomPendente correto
                database.get("SELECT cliente_id, nome_cliente FROM Pedido WHERE id = ?", [pedido_id], (errP, orderInfo) => {
                    const clientID = req.body.cliente_id || (orderInfo ? orderInfo.cliente_id : null);
                    const clientNome = req.body.cliente_nome || (orderInfo ? orderInfo.nome_cliente : null);
                    
                    const descricaoBase = mesa_id 
                        ? `Mesa ${mesa_id} (Pedido #${pedido_id})` 
                        : `Balcão/Delivery (Pedido #${pedido_id})`;

                    listaPagamentos.forEach((pg) => {
                        database.get(
                            'SELECT is_cupom FROM ModosDePagamento WHERE id = ?',
                            [pg.metodo_pagamento_id],
                            (errM, metodo) => {
                                // Primeiro insere no PedidoPagamento de qualquer forma (histórico)
                                database.run(
                                    "INSERT INTO PedidoPagamento (pedido_id, metodo_pagamento_id, valor) VALUES (?, ?, ?)",
                                    [pedido_id, pg.metodo_pagamento_id, pg.valor]
                                );

                                if (!errM && metodo && Number(metodo.is_cupom) === 1) {
                                    // VALIDAÇÃO: Cupom só para Delivery
                                    if (mesa_id) {
                                        console.error(`[Pedido] Bloqueado: Tentativa de usar Cupom em Mesa ${mesa_id}`);
                                        return;
                                    }

                                    // Pagamento diferido (Pendura): NÃO ENTRA NO FLUXO DE CAIXA
                                    database.run(
                                        `INSERT INTO CupomPendente (pedido_id, cliente_id, cliente_nome, valor, valor_original, descricao, status) VALUES (?, ?, ?, ?, ?, ?, 'Pendente')`,
                                        [pedido_id, clientID, clientNome, pg.valor, pg.valor, descricaoBase]
                                    );
                                    if (clientID) {
                                        database.run(
                                            `UPDATE Cliente SET valor_pendente = COALESCE(valor_pendente, 0) + ? WHERE id = ?`,
                                            [pg.valor, clientID]
                                        );
                                    }
                                } else {
                                    // Pagamento normal: FluxoCaixa
                                    database.run(
                                        "INSERT INTO FluxoCaixa (tipo, valor, metodo_pagamento_id, descricao, data_movimentacao) VALUES ('Entrada', ?, ?, ?, ?)",
                                        [pg.valor, pg.metodo_pagamento_id, `Recebimento ${descricaoBase}`, getAgoraSP()],
                                        function(errFC) {
                                            if (errFC) console.error("[Pedido] Erro ao inserir fluxo de caixa:", errFC.message);
                                        }
                                    );
                                }
                            }
                        );
                    });
                });

            // 3. Verifica taxas e atualiza saldo do Entregador
            if (entregador_id) {
                const sqlTaxas = `
                    SELECT SUM(ip.valor * ip.count) as total_taxa
                    FROM ItemPedido ip
                    JOIN Produto pr ON ip.produto_id = pr.id
                    WHERE ip.pedido_id = ? AND pr.is_taxa = 1
                `;
                
                // Nota: O campo quantidade pode estar como 'quantidade' ou 'count' no banco dependendo da versão
                // Atualmente o database.js usa 'quantidade'.
                const sqlTaxasCorrect = `
                    SELECT SUM(ip.valor * ip.quantidade) as total_taxa
                    FROM ItemPedido ip
                    JOIN Produto pr ON ip.produto_id = pr.id
                    WHERE ip.pedido_id = ? AND pr.is_taxa = 1
                `;

                database.get(sqlTaxasCorrect, [pedido_id], (errTaxa, row) => {
                    const valorTaxa = (row && row.total_taxa) ? row.total_taxa : 0;
                    
                    const sqlEntregador = `UPDATE Entregador SET quantidade_entregas_dia = quantidade_entregas_dia + 1, saldo = saldo + ? WHERE id = ?`;
                    database.run(sqlEntregador, [valorTaxa, entregador_id], function(errE) {
                        if (errE) console.error("Erro ao computar entregador:", errE);
                        if (valorTaxa > 0) {
                            database.run("INSERT INTO HistoricoEntrega (entregador_id, pedido_id, valor_taxa) VALUES (?, ?, ?)", 
                                [entregador_id, pedido_id, valorTaxa]);
                        }
                        return res.json({ 
                            message: "Pedido finalizado com multi-pagamento!", 
                            taxa_repasse: valorTaxa 
                        });
                    });
                });
                } else {
                    return res.json({ message: "Pedido finalizado com multi-pagamento!" });
                }
            });
        });
    });
});


// Rota removida (duplicada e com erro de SQL). Usar /api/caixa/saldo-atual.

// --- ROTAS DE RASCUNHO DE PEDIDOS ---

router.get('/rascunhos', (req, res) => {
    const database = db();
    database.all("SELECT * FROM RascunhoPedido ORDER BY data_atualizacao DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

router.post('/rascunhos', (req, res) => {
    const { identificacao, dados_json } = req.body;
    const database = db();
    if (!identificacao || !dados_json) return res.status(400).json({ error: "Faltam dados." });

    database.run(
        "INSERT INTO RascunhoPedido (identificacao, dados_json) VALUES (?, ?)",
        [identificacao, dados_json],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            // Tratar fallback se this.lastID não vier do sql.js wraper dependendo da impl
            let id = this ? this.lastID : null;
            if(!id) {
                database.get("SELECT id FROM RascunhoPedido ORDER BY id DESC LIMIT 1", [], (e, row) => {
                    res.status(201).json({ id: row ? row.id : null, identificacao, dados_json });
                });
            } else {
                res.status(201).json({ id, identificacao, dados_json });
            }
        }
    );
});

router.put('/rascunhos/:id', (req, res) => {
    const { identificacao, dados_json } = req.body;
    const { id } = req.params;
    const database = db();

    if (!identificacao || !dados_json) return res.status(400).json({ error: "Faltam dados." });

    database.run(
        "UPDATE RascunhoPedido SET identificacao = ?, dados_json = ?, data_atualizacao = datetime('now', 'localtime') WHERE id = ?",
        [identificacao, dados_json, id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Rascunho atualizado com sucesso." });
        }
    );
});

router.delete('/rascunhos/:id', (req, res) => {
    const { id } = req.params;
    const database = db();
    database.run("DELETE FROM RascunhoPedido WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Rascunho deletado com sucesso." });
    });
});

module.exports = router;