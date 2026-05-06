const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { getAgoraSP } = require('../utils/dateUtils');

// Registrar movimentação (Abertura, Sangria, Suprimento)
router.post('/movimentar', (req, res) => {
    const dataLocal = getAgoraSP();
    const { tipo, valor, descricao, metodo_pagamento_id } = req.body;
    const database = db();
    
    const sql = `INSERT INTO FluxoCaixa (tipo, valor, descricao, metodo_pagamento_id, data_movimentacao) VALUES (?, ?, ?, ?, ?)`;
    database.run(sql, [tipo, valor, descricao, metodo_pagamento_id, dataLocal], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Movimentação registrada!", id: this.lastID });
    });
});

// Obter saldo atual detalhado por método
router.get('/saldo-atual', (req, res) => {
    const database = db();
    
    const sql = `
        SELECT 
            f.tipo, 
            SUM(f.valor) as total,
            IFNULL(m.nome, 'Dinheiro/Geral') as metodo_nome
        FROM FluxoCaixa f
        LEFT JOIN ModosDePagamento m ON f.metodo_pagamento_id = m.id
        GROUP BY f.tipo, IFNULL(m.nome, 'Dinheiro/Geral')
    `;

    database.all(sql, [], (err, rows) => {
        if (err) {
            // Isso vai imprimir o erro real no terminal onde o NODE está rodando
            console.error("❌ ERRO CRÍTICO NO SQL DO CAIXA:", err.message);
            return res.status(500).json({ 
                error: "Erro no banco de dados", 
                details: err.message 
            });
        }
        console.log("📊 Dados recuperados do caixa:", rows);
        res.json({ data: rows });
    });
});

//Relatorio de fechamento do caixa
router.get('/relatorio-fechamento', (req, res) => {
    const database = db();
    
    // Busca a última abertura para saber de onde partir
    const sqlAbertura = `SELECT valor, data_movimentacao FROM FluxoCaixa WHERE tipo = 'Abertura' ORDER BY id DESC LIMIT 1`;

    database.get(sqlAbertura, [], (err, abertura) => {
        if (err) return res.status(500).json({ error: err.message });

        const dataInicio = abertura ? abertura.data_movimentacao : '1970-01-01';
        const valorAbertura = abertura ? abertura.valor : 0;

        // Busca todas as movimentações desde a abertura
        const sqlMovimentacoes = `
            SELECT f.*, IFNULL(m.nome, 'Dinheiro/Geral') as metodo 
            FROM FluxoCaixa f
            LEFT JOIN ModosDePagamento m ON f.metodo_pagamento_id = m.id
            WHERE f.data_movimentacao >= ?
            ORDER BY f.data_movimentacao ASC
        `;

        database.all(sqlMovimentacoes, [dataInicio], (err, itens) => {
            if (err) return res.status(500).json({ error: err.message });
            
            // Extrai os IDs dos Pedidos a partir da descrição para buscar detalhes extras
            const pedidoIds = [];
            itens.forEach(item => {
                const match = item.descricao.match(/Pedido #(\d+)/);
                if (match) {
                    item.pedido_id = parseInt(match[1]);
                    pedidoIds.push(item.pedido_id);
                }
            });

            if (pedidoIds.length > 0) {
                const placeholders = pedidoIds.map(() => '?').join(',');
                const sqlPedidos = `SELECT p.id, p.tipo, p.nome_cliente, c.nome as c_nome, e.nome as entregador_nome, p.observacao
                                    FROM Pedido p 
                                    LEFT JOIN Cliente c ON p.cliente_id = c.id
                                    LEFT JOIN Entregador e ON p.entregador_id = e.id
                                    WHERE p.id IN (${placeholders})`;
                database.all(sqlPedidos, pedidoIds, (err, pedidos) => {
                    const pedidosMap = {};
                    if (!err && pedidos) {
                        pedidos.forEach(p => pedidosMap[p.id] = p);
                    }
                    itens.forEach(item => {
                        if (item.pedido_id && pedidosMap[item.pedido_id]) {
                            item.pedido_tipo = pedidosMap[item.pedido_id].tipo;
                            item.cliente_nome = pedidosMap[item.pedido_id].c_nome || pedidosMap[item.pedido_id].nome_cliente;
                            item.entregador_nome = pedidosMap[item.pedido_id].entregador_nome;
                            item.observacao_pedido = pedidosMap[item.pedido_id].observacao;
                        }
                    });
                    res.json({ abertura: valorAbertura, itens: itens });
                });
            } else {
                res.json({ abertura: valorAbertura, itens: itens });
            }
        });
    });
});

// Fechamento de caixa
router.post('/fechar-caixa', (req, res) => {
    const database = db();

    database.serialize(() => {
        // 1. Copia tudo da tabela ativa para o histórico
        const sqlArchive = `
            INSERT INTO HistoricoFluxoCaixa (tipo, valor, metodo_pagamento_id, descricao, data_movimentacao)
            SELECT tipo, valor, metodo_pagamento_id, descricao, data_movimentacao FROM FluxoCaixa
        `;

        database.run(sqlArchive, [], function(err) {
            if (err) return res.status(500).json({ error: "Erro ao arquivar: " + err.message });

            // 2. Limpa a tabela ativa para o próximo dia
            database.run("DELETE FROM FluxoCaixa", [], function(err) {
                if (err) return res.status(500).json({ error: "Erro ao limpar caixa: " + err.message });
                
                res.json({ message: "Caixa encerrado e arquivado com sucesso!" });
            });
        });
    });
});

// Obter dias com fechamento de caixa
router.get('/historico-dias', (req, res) => {
    const database = db();
    const sql = `
        SELECT DISTINCT date(data_movimentacao) as data
        FROM HistoricoFluxoCaixa
        ORDER BY data DESC
    `;
    database.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows.map(r => r.data) });
    });
});

// Obter relatório de um dia específico do histórico
router.get('/historico-dia/:data', (req, res) => {
    const database = db();
    const { data } = req.params;
    
    const sql = `
        SELECT f.*, IFNULL(m.nome, 'Dinheiro/Geral') as metodo 
        FROM HistoricoFluxoCaixa f
        LEFT JOIN ModosDePagamento m ON f.metodo_pagamento_id = m.id
        WHERE date(f.data_movimentacao) = ?
        ORDER BY f.data_movimentacao ASC
    `;
    
    database.all(sql, [data], (err, itens) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const aberturaItem = itens.find(i => i.tipo === 'Abertura');
        const valorAbertura = aberturaItem ? aberturaItem.valor : 0;
        
        const pedidoIds = [];
        itens.forEach(item => {
            if (item.descricao) {
                const match = item.descricao.match(/Pedido #(\d+)/);
                if (match) {
                    item.pedido_id = parseInt(match[1]);
                    pedidoIds.push(item.pedido_id);
                }
            }
        });

        if (pedidoIds.length > 0) {
            const placeholders = pedidoIds.map(() => '?').join(',');
            const sqlPedidos = `SELECT p.id, p.tipo, p.nome_cliente, c.nome as c_nome, e.nome as entregador_nome, p.observacao
                                FROM Pedido p 
                                LEFT JOIN Cliente c ON p.cliente_id = c.id
                                LEFT JOIN Entregador e ON p.entregador_id = e.id
                                WHERE p.id IN (${placeholders})`;
            database.all(sqlPedidos, pedidoIds, (err, pedidos) => {
                const pedidosMap = {};
                if (!err && pedidos) {
                    pedidos.forEach(p => pedidosMap[p.id] = p);
                }
                itens.forEach(item => {
                    if (item.pedido_id && pedidosMap[item.pedido_id]) {
                        item.pedido_tipo = pedidosMap[item.pedido_id].tipo;
                        item.cliente_nome = pedidosMap[item.pedido_id].c_nome || pedidosMap[item.pedido_id].nome_cliente;
                        item.entregador_nome = pedidosMap[item.pedido_id].entregador_nome;
                        item.observacao_pedido = pedidosMap[item.pedido_id].observacao;
                    }
                });
                res.json({ abertura: valorAbertura, itens: itens });
            });
        } else {
            res.json({ abertura: valorAbertura, itens: itens });
        }
    });
});

// Imprimir Relatório de Caixa via Thermal Printer
router.post('/imprimir', (req, res) => {
    const { tipoImpressao, relatorio } = req.body;
    const database = db();
    const ThermalPrinter = require("node-thermal-printer").printer;
    const PrinterTypes = require("node-thermal-printer").types;
    const { exec } = require('child_process');
    const path = require('path');
    const fs = require('fs');

    database.get("SELECT impressora_caminho FROM Configuracoes WHERE id = 1", [], (err, config) => {
        if (err || !config || !config.impressora_caminho) {
            return res.status(500).json({ error: "Impressora não configurada no sistema." });
        }

        try {
            let printer = new ThermalPrinter({
                type: PrinterTypes.EPSON,
                interface: 'none',
                characterSet: 'PC860_PORTUGUESE',
                removeSpecialCharacters: false,
                lineCharacter: "-",
                options: { timeout: 5000 }
            });

            printer.alignCenter();
            printer.setTextDoubleHeight();
            printer.setTextDoubleWidth();
            printer.println("FLUXO DE CAIXA");
            printer.setTextNormal();
            printer.println(`Emissao: ${getAgoraSP()}`);
            printer.drawLine();

            printer.alignLeft();
            printer.println(`ABERTURA: R$ ${relatorio.abertura.toFixed(2)}`);
            printer.drawLine();

            if (tipoImpressao === 'saldo') {
                printer.alignCenter();
                printer.println("RESUMO DE SALDOS");
                printer.alignLeft();
                
                const totais = relatorio.itens.reduce((acc, item) => {
                    if (!acc[item.metodo]) acc[item.metodo] = 0;
                    if (['Entrada', 'Suprimento', 'Abertura'].includes(item.tipo)) acc[item.metodo] += item.valor;
                    if (['Sangria', 'Saída'].includes(item.tipo)) acc[item.metodo] -= item.valor;
                    return acc;
                }, {});

                for (const [m, val] of Object.entries(totais)) {
                    printer.leftRight(m, `R$ ${val.toFixed(2)}`);
                }
            } else {
                printer.alignCenter();
                printer.println("LISTAGEM DETALHADA");
                printer.alignLeft();

                relatorio.itens.forEach(item => {
                    const hora = new Date(item.data_movimentacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    printer.println(`${hora} - ${item.tipo}`);
                    printer.leftRight(item.descricao.substring(0, 25), `R$ ${item.valor.toFixed(2)}`);
                    
                    if (item.cliente_nome) printer.println(`   Cli: ${item.cliente_nome}`);
                    if (item.entregador_nome) printer.println(`   Entg: ${item.entregador_nome}`);
                    printer.println(" "); // empty visual break
                });
            }

            printer.drawLine();
            
            const totalLiquido = Object.values(relatorio.itens.reduce((acc, item) => {
                if (!acc[item.metodo]) acc[item.metodo] = 0;
                if (['Entrada', 'Suprimento', 'Abertura'].includes(item.tipo)) acc[item.metodo] += item.valor;
                if (['Sangria', 'Saída'].includes(item.tipo)) acc[item.metodo] -= item.valor;
                return acc;
            }, {})).reduce((a, b) => a + b, 0);

            printer.setTextDoubleHeight();
            printer.leftRight("TOTAL LIQ:", `R$ ${totalLiquido.toFixed(2)}`);
            printer.setTextNormal();
            printer.drawLine();
            printer.println("");
            printer.println("");
            printer.alignCenter();
            printer.println("_________________________");
            printer.println("Gerente");
            printer.cut();

            const buffer = printer.getBuffer();
            const tempFile = path.join(__dirname, '..', `caixa_print_${Date.now()}.bin`);
            fs.writeFileSync(tempFile, buffer);

            const comando = `copy /b "${tempFile}" "${config.impressora_caminho}"`;
            
            exec(comando, (execErr) => {
                try { fs.unlinkSync(tempFile); } catch(e) {}
                if (execErr) {
                    console.error('[Caixa] Erro ao imprimir:', execErr.message);
                    return res.status(500).json({ error: "Falha ao comunicar com Windows spooler" });
                }
                res.json({ message: "Relatório enviado para a impressora!" });
            });

        } catch (e) {
            console.error("Erro na montagem do relatorio p/ impressao:", e);
            res.status(500).json({ error: "Erro interno ao gerar layout termico" });
        }
    });

});

module.exports = router;