// routes/produtoRoutes.js
const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { ensureAdmin } = require('../middleware/auth');

// [GET] /produtos: Lista com Filtros Avançados
router.get('/', (req, res) => {
    const database = db();
    const { nome, categoria, estado } = req.query;

    let sql = "SELECT * FROM Produto WHERE 1=1";
    const params = [];

    // Lógica de Busca Inteligente
    if (nome) {
        // Se o que foi digitado for APENAS números, busca pelo ID
        if (/^\d+$/.test(nome)) {
            sql += " AND id = ?";
            params.push(parseInt(nome));
        } else {
            // Se tiver letras, busca pelo Nome
            sql += " AND nome LIKE ?";
            params.push(`%${nome}%`);
        }
    }

    if (categoria && categoria !== 'Todos') {
        sql += " AND categoria = ?";
        params.push(categoria);
    }

    if (estado === 'ativo') {
        sql += " AND ativo = 1";
    } else if (estado === 'desativado') {
        sql += " AND ativo = 0";
    }

    sql += " ORDER BY categoria, nome";

    database.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ "error": err.message });
        res.json({ "message": "success", "data": rows });
    });
});

// [POST] /produtos: Adiciona novo produto com múltiplos preços
router.post('/', ensureAdmin, (req, res) => {
    const database = db();
    const { nome, preco, preco_broto, categoria, descricao, ativo, is_taxa } = req.body;
    
    // Log para depuração no terminal do VS Code
    console.log("Tentando salvar produto:", req.body);

    if (!nome || !preco || !categoria) {
        return res.status(400).json({ "error": "Campos nome, preco e categoria são obrigatórios." });
    }
    
    const sql = `INSERT INTO Produto (nome, preco, preco_broto, categoria, descricao, ativo, is_taxa) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    database.run(sql, [nome, preco, preco_broto || 0, categoria, descricao, ativo ?? 1, is_taxa ?? 0], function(err) {
        if (err) {
            console.error("❌ Erro no Banco de Dados:", err.message);
            return res.status(500).json({ "error": "Erro ao salvar: " + err.message });
        }
        res.status(201).json({ "message": "Produto cadastrado!", "id": this.lastID });
    });
});

// [PUT] /produtos/:id: Atualiza produto
router.put('/:id', ensureAdmin, (req, res) => {
    const database = db();
    const { id } = req.params;
    const { nome, preco, preco_broto, categoria, descricao, ativo, is_taxa } = req.body;

    const sql = `UPDATE Produto SET nome = ?, preco = ?, preco_broto = ?, 
                 categoria = ?, descricao = ?, ativo = ?, is_taxa = ? WHERE id = ?`;

    database.run(sql, [nome, preco, preco_broto, categoria, descricao, ativo, is_taxa ?? 0, id], function(err) {
        if (err) return res.status(500).json({ "error": err.message });
        if (this.changes === 0) return res.status(404).json({ "error": "Produto não encontrado" });
        res.json({ "message": "Produto atualizado com sucesso" });
    });
});

// [GET] /produtos/exportar: Exporta todos os produtos em CSV
router.get('/exportar', (req, res) => {
    const database = db();
    database.all("SELECT id, nome, descricao, preco, preco_broto, categoria, ativo, is_taxa FROM Produto ORDER BY id ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const headers = ['id', 'nome', 'descricao', 'preco', 'preco_broto', 'categoria', 'ativo', 'is_taxa'];
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
        res.setHeader('Content-Disposition', 'attachment; filename=cardapio.csv');
        res.send('\uFEFF' + csv); // BOM para Excel reconhecer UTF-8
    });
});

// [POST] /produtos/importar: Importa produtos via CSV
router.post('/importar', ensureAdmin, (req, res) => {
    const multer = require('multer');
    const upload = multer({ storage: multer.memoryStorage() }).single('arquivo');

    upload(req, res, function(uploadErr) {
        if (uploadErr) return res.status(400).json({ error: 'Erro no upload do arquivo.' });
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

        const content = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, ''); // Remove BOM
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

        if (lines.length < 2) return res.status(400).json({ error: 'Arquivo CSV vazio ou sem dados.' });

        // Parse CSV header
        const headerLine = lines[0];
        const headers = parseCsvLine(headerLine).map(h => h.trim().toLowerCase());

        const requiredHeaders = ['nome', 'preco', 'categoria'];
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

            const id = row.id ? parseInt(row.id) : null;
            const nome = row.nome;
            const preco = parseFloat(row.preco) || 0;
            const preco_broto = parseFloat(row.preco_broto) || 0;
            const categoria = row.categoria || 'Outros';
            const descricao = row.descricao || '';
            const ativo = row.ativo !== undefined && row.ativo !== '' ? parseInt(row.ativo) : 1;
            const is_taxa = row.is_taxa !== undefined && row.is_taxa !== '' ? parseInt(row.is_taxa) : 0;

            if (!nome) { erros++; processados++; checkDone(); continue; }

            // Upsert: atualiza se existir, cria se não existir
            let query = "SELECT id FROM Produto WHERE nome = ?";
            let params = [nome];
            if (id) {
                query = "SELECT id FROM Produto WHERE id = ?";
                params = [id];
            }

            database.get(query, params, (err, existing) => {
                if (existing) {
                    database.run(
                        "UPDATE Produto SET nome=?, preco=?, preco_broto=?, categoria=?, descricao=?, ativo=?, is_taxa=? WHERE id=?",
                        [nome, preco, preco_broto, categoria, descricao, ativo, is_taxa, existing.id],
                        () => { atualizados++; processados++; checkDone(); }
                    );
                } else {
                    if (id) {
                        database.run(
                            "INSERT INTO Produto (id, nome, preco, preco_broto, categoria, descricao, ativo, is_taxa) VALUES (?,?,?,?,?,?,?,?)",
                            [id, nome, preco, preco_broto, categoria, descricao, ativo, is_taxa],
                            () => { criados++; processados++; checkDone(); }
                        );
                    } else {
                        database.run(
                            "INSERT INTO Produto (nome, preco, preco_broto, categoria, descricao, ativo, is_taxa) VALUES (?,?,?,?,?,?,?)",
                            [nome, preco, preco_broto, categoria, descricao, ativo, is_taxa],
                            () => { criados++; processados++; checkDone(); }
                        );
                    }
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