// routes/clienteRoutes.js
const express = require('express');
const router = express.Router();
const { db } = require('../database'); // Conexão com SQLite
const { ensureAuthenticated } = require('../middleware/auth');

// --- 1. Rota POST: Cria um novo cliente (Tratamento de 409 OK) ---
router.post('/', (req, res) => {
    const database = db();
    const { nome, telefone, celular, endereco, numero, CEP, complemento, observacao, bairro } = req.body;

    // Log para você ver no terminal do VS Code o que está chegando
    console.log("Recebendo dados para cadastro:", req.body);

    if (!nome || !telefone) {
        return res.status(400).json({ error: 'Nome e Telefone são obrigatórios.' });
    }

    // Primeiro verifica se já existe (para lógica de reativação)
    database.get('SELECT id, ativo FROM Cliente WHERE telefone = ?', [telefone], (err, row) => {
        if (err) {
            console.error("❌ Erro ao consultar banco:", err.message);
            return res.status(500).json({ error: 'Erro ao consultar banco de dados.' });
        }

        if (row && row.ativo === 1) {
            return res.status(409).json({ error: 'Este telefone já está cadastrado para um cliente ativo.' });
        }

        if (row && row.ativo === 0) {
            // REATIVAR
            const sqlUpdate = `UPDATE Cliente SET nome=?, celular=?, endereco=?, numero=?, CEP=?, complemento=?, observacao=?, bairro=?, ativo=1 WHERE id=?`;
            database.run(sqlUpdate, [nome, celular, endereco, numero, CEP, complemento, observacao, bairro, row.id], function(upErr) {
                if (upErr) return res.status(500).json({ error: upErr.message });
                res.json({ message: 'Cliente reativado!', data: { id: row.id, ...req.body } });
            });
        } else {
            // NOVO INSERT - Verifique se os nomes das colunas batem com seu banco
            const sqlInsert = `INSERT INTO Cliente (nome, telefone, celular, endereco, numero, CEP, complemento, observacao, bairro, ativo) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`;
            
            database.run(sqlInsert, [nome, telefone, celular, endereco, numero, CEP, complemento, observacao, bairro], function(insErr) {
                if (insErr) {
                    console.error("❌ Erro no INSERT:", insErr.message);
                    return res.status(500).json({ error: `Erro ao salvar: ${insErr.message}` });
                }
                res.status(201).json({ message: 'Cliente cadastrado!', data: { id: this.lastID, ...req.body } });
            });
        }
    });
});

// --- 2. Rota PUT: Atualizar Cliente por ID ---
router.put('/:id', (req, res) => {
    const database = db();
    const { id } = req.params;
    const { nome, telefone, celular, endereco, numero, 
        CEP, complemento, observacao, bairro 
    } = req.body;

    const sql = `
        UPDATE Cliente 
        SET nome = ?, telefone = ?, celular = ?, endereco = ?, numero = ?, CEP = ?, complemento = ?, observacao = ?, bairro = ?
        WHERE id = ?`;
        
    database.run(sql, [nome, telefone, celular, endereco, numero, CEP, complemento, observacao, bairro, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Cliente atualizado com sucesso!' });
    });
});

// --- 3. Rota GET: Listar Todos os Clientes ---
router.get('/', (req, res) => {
    const database = db();
    const sql = 'SELECT * FROM Cliente ORDER BY nome ASC';

    database.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Erro ao listar clientes:", err.message);
            return res.status(500).json({ error: 'Erro interno do servidor.' });
        }
        res.json({ message: 'Lista de clientes', data: rows });
    });
});

// --- 4. Rota GET: Busca cliente por telefone ou nome ---
router.get('/busca', (req, res) => {
    const database = db();
    const termo = req.query.tel;
    
    if (!termo) {
        return res.status(400).json({ "error": "O parâmetro de busca é obrigatório." });
    }

    const telDigits = termo.replace(/[^0-9]/g, '');
    const likeTel = telDigits.length > 0 ? `%${telDigits}%` : 'NO_MATCH_#@!';
    const likeNome = `%${termo.trim()}%`;

    const sql = `
        SELECT * FROM Cliente 
        WHERE (replace(replace(replace(telefone, '(', ''), ')', ''), '-', '') LIKE ?)
           OR (replace(replace(replace(celular, '(', ''), ')', ''), '-', '') LIKE ?)
           OR (nome LIKE ?)
        ORDER BY nome ASC
        LIMIT 50`;

    database.all(sql, [likeTel, likeTel, likeNome], (err, rows) => {
        if (err) return res.status(500).json({ "error": err.message });
        
        if (rows && rows.length > 0) {
            res.json({ "message": "Clientes encontrados", "data": rows });
        } else {
            res.status(404).json({ "message": "Nenhum cliente encontrado", "data": [] });
        }
    });
});

// [GET] /clientes/exportar: Exporta todos os clientes em CSV
router.get('/exportar', (req, res) => {
    const database = db();
    database.all("SELECT nome, telefone, celular, endereco, bairro, numero, CEP, complemento, observacao, ativo FROM Cliente ORDER BY nome", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const headers = ['nome', 'telefone', 'celular', 'endereco', 'bairro', 'numero', 'CEP', 'complemento', 'observacao', 'ativo'];
        const escapeCsv = (val) => {
            if (val === null || val === undefined) return '';
            const s = String(val);
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
        };

        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += headers.map(h => escapeCsv(row[h])).join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=clientes.csv');
        res.send('\uFEFF' + csv);
    });
});

// [POST] /clientes/importar: Importa clientes via CSV
router.post('/importar', (req, res) => {
    const multer = require('multer');
    const upload = multer({ storage: multer.memoryStorage() }).single('arquivo');

    upload(req, res, function(uploadErr) {
        if (uploadErr) return res.status(400).json({ error: 'Erro no upload do arquivo.' });
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

        const content = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

        if (lines.length < 2) return res.status(400).json({ error: 'Arquivo CSV vazio ou sem dados.' });

        const headerLine = lines[0];
        const headers = parseCsvLine(headerLine).map(h => h.trim().toLowerCase());

        const requiredHeaders = ['nome', 'telefone'];
        const missing = requiredHeaders.filter(h => !headers.includes(h));
        if (missing.length > 0) {
            return res.status(400).json({ error: `Colunas obrigatórias ausentes: ${missing.join(', ')}` });
        }

        const database = db();
        let criados = 0, atualizados = 0, erros = 0;
        let processados = 0;
        const totalLinhas = lines.length - 1;

        for (let i = 1; i < lines.length; i++) {
            const values = parseCsvLine(lines[i]);
            const row = {};
            headers.forEach((h, idx) => { row[h] = values[idx] !== undefined ? values[idx].trim() : ''; });

            const nome = row.nome;
            const telefone = row.telefone;
            const celular = row.celular || '';
            const endereco = row.endereco || '';
            const bairro = row.bairro || '';
            const numero = row.numero || '';
            const cep = row.cep || '';
            const complemento = row.complemento || '';
            const observacao = row.observacao || '';
            const ativo = row.ativo !== undefined && row.ativo !== '' ? parseInt(row.ativo) : 1;

            if (!nome || !telefone) { erros++; processados++; checkDone(); continue; }

            database.get("SELECT id FROM Cliente WHERE telefone = ?", [telefone], (err, existing) => {
                if (existing) {
                    database.run(
                        "UPDATE Cliente SET nome=?, celular=?, endereco=?, bairro=?, numero=?, CEP=?, complemento=?, observacao=?, ativo=? WHERE id=?",
                        [nome, celular, endereco, bairro, numero, cep, complemento, observacao, ativo, existing.id],
                        () => { atualizados++; processados++; checkDone(); }
                    );
                } else {
                    database.run(
                        "INSERT INTO Cliente (nome, telefone, celular, endereco, bairro, numero, CEP, complemento, observacao, ativo) VALUES (?,?,?,?,?,?,?,?,?,?)",
                        [nome, telefone, celular, endereco, bairro, numero, cep, complemento, observacao, ativo],
                        () => { criados++; processados++; checkDone(); }
                    );
                }
            });
        }

        function checkDone() {
            if (processados >= totalLinhas) {
                res.json({ message: `Importação concluída! ${criados} criados, ${atualizados} atualizados, ${erros} erros.` });
            }
        }
    });
});

// --- 5. Rota GET: Histórico de pedidos de um cliente ---
router.get('/:id/pedidos', (req, res) => {
    const database = db();
    const { id } = req.params;
    const limite = parseInt(req.query.limite) || 10;

    const limiteSql = limite === 0 ? '' : `LIMIT ${limite}`;

    const sql = `
        SELECT 
            p.id,
            p.data_hora,
            p.status,
            p.valor_total,
            p.desconto,
            p.tipo,
            p.observacao,
            e.nome AS entregador_nome,
            (SELECT GROUP_CONCAT(mp.nome, ' + ') 
             FROM PedidoPagamento pp 
             JOIN ModosDePagamento mp ON pp.metodo_pagamento_id = mp.id 
             WHERE pp.pedido_id = p.id) as modo_pagamento_detalhe,
            (SELECT status FROM CupomPendente WHERE pedido_id = p.id LIMIT 1) as cupom_status,
            (SELECT valor FROM CupomPendente WHERE pedido_id = p.id LIMIT 1) as cupom_valor_pendente
        FROM Pedido p
        LEFT JOIN Entregador e ON p.entregador_id = e.id
        WHERE p.cliente_id = ?
        ORDER BY p.data_hora DESC
        ${limiteSql}
    `;

    database.all(sql, [id], (err, pedidos) => {
        if (err) return res.status(500).json({ error: err.message });

        if (pedidos.length === 0) return res.json({ data: [] });

        let processados = 0;
        const resultado = [];

        pedidos.forEach((pedido, idx) => {
            // Se modo_pagamento_detalhe for nulo (pode acontecer se for só cupom), 
            // tenta buscar se tem cupom para descrever
            let displayPagamento = pedido.modo_pagamento_detalhe || '';
            if (pedido.cupom_status) {
                const cupomTexto = `Cupom (${pedido.cupom_status})`;
                displayPagamento = displayPagamento ? `${displayPagamento} + ${cupomTexto}` : cupomTexto;
            }

            database.all(
                `SELECT ip.quantidade, ip.nome, ip.valor, ip.observacao 
                 FROM ItemPedido ip WHERE ip.pedido_id = ?`,
                [pedido.id],
                (errItens, itens) => {
                    resultado[idx] = { 
                        ...pedido, 
                        modo_pagamento: displayPagamento || 'Não informado',
                        itens: itens || [] 
                    };
                    processados++;
                    if (processados === pedidos.length) {
                        res.json({ data: resultado });
                    }
                }
            );
        });
    });
});

// --- 6. Rota GET: Retorna um cliente específico por ID ---
router.get('/:id', (req, res) => {

    const database = db();
    const { id } = req.params;
    
    database.get("SELECT * FROM Cliente WHERE id = ?", [id], (err, row) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        
        if (row) {
            res.json({ "message": "success", "data": row });
        } else {
            res.status(404).json({ "message": "Cliente não encontrado" });
        }
    });
});

// --- 6. Rota DELETE: Deletar Cliente por ID ---
router.delete('/:id', (req, res) => {
    const database = db();
    const { id } = req.params;

    // 1. Verificamos se existe valor pendente antes de desativar
    database.get('SELECT nome, valor_pendente FROM Cliente WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Cliente não encontrado.' });

        if (row.valor_pendente > 0) {
            return res.status(400).json({ 
                error: `Impossível desativar ${row.nome}. Existe débito de R$ ${row.valor_pendente.toFixed(2)}.` 
            });
        }

        // 2. Soft Delete: Apenas muda o status para 0
        const sql = 'UPDATE Cliente SET ativo = 0 WHERE id = ?';
        database.run(sql, [id], function(updateErr) {
            if (updateErr) return res.status(500).json({ error: updateErr.message });
            res.json({ message: `Cliente "${row.nome}" desativado com sucesso.` });
        });
    });
});

// Helper: Parse uma linha CSV respeitando aspas
function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
            else if (ch === '"') { inQuotes = false; }
            else { current += ch; }
        } else {
            if (ch === '"') { inQuotes = true; }
            else if (ch === ',') { result.push(current); current = ''; }
            else { current += ch; }
        }
    }
    result.push(current);
    return result;
}

module.exports = router;