// routes/configRoutes.js
const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { ensureAdmin } = require('../middleware/auth');
const multer = require('multer'); 
const path = require('path');
const fs = require('fs');

const isPacked = process.pkg; 
const executableDir = isPacked ? path.dirname(process.execPath) : path.join(__dirname, '..', '..');
const uploadDir = path.join(executableDir, 'pizzaria-server', 'uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// --- Rota GET: Buscar Configurações ---
router.get('/', (req, res) => {
    const database = db();
    const sql = "SELECT * FROM Configuracoes WHERE id = 1";
    database.get(sql, [], (err, row) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar configurações.' });

        if (row && row.print_order) {
            try { row.print_order = JSON.parse(row.print_order); }
            catch (e) { 
                if (typeof row.print_order === 'string') {
                    row.print_order = row.print_order.split(',').map(s => s.trim()).filter(Boolean);
                } else { row.print_order = []; }
            }
        } else { row.print_order = []; }

        // Trata print_order_cozinha
        if (row && row.print_order_cozinha) {
            try { row.print_order_cozinha = JSON.parse(row.print_order_cozinha); }
            catch (e) { row.print_order_cozinha = String(row.print_order_cozinha).split(',').map(s => s.trim()).filter(Boolean); }
        } else { row.print_order_cozinha = []; }

        // Trata print_order_entregador
        if (row && row.print_order_entregador) {
            try { row.print_order_entregador = JSON.parse(row.print_order_entregador); }
            catch (e) { row.print_order_entregador = String(row.print_order_entregador).split(',').map(s => s.trim()).filter(Boolean); }
        } else { row.print_order_entregador = []; }

        console.log("✅ Config enviada ao frontend:", row); // DEBUG
        res.json({ data: row });
    });
});

// --- Rota PUT: Atualizar Configurações (Apenas Admin) ---
router.put('/', ensureAdmin, (req, res) => {
    const database = db();
    const data = req.body;

    if (Array.isArray(data.print_order)) {
        data.print_order = data.print_order.join(',');
    }
    if (Array.isArray(data.print_order_cozinha)) {
        data.print_order_cozinha = data.print_order_cozinha.join(',');
    }
    if (Array.isArray(data.print_order_entregador)) {
        data.print_order_entregador = data.print_order_entregador.join(',');
    }

    // Sanitização de campos que devem ser Inteiros (0 ou 1)
    const toInt = (val) => (val === true || val === 1 || val === '1') ? 1 : 0;

    const sql = `UPDATE Configuracoes SET 
        nome_pizzaria = ?, endereco = ?, rua = ?, bairro = ?, 
        cidade = ?, estado = ?, telefone = ?, cnpj = ?, 
        show_itens_pedido = ?, show_valor_total = ?, 
        print_order = ?, print_order_cozinha = ?, print_order_entregador = ?,
        taxa_servico_padrao = ?, calculo_pizza = ?,
        historico_pedidos_limite = ?, impressora_caminho = ?,
        impressora_tipo = ?, print_font_size = ?
        WHERE id = 1`;

    const params = [
        data.nome_pizzaria, data.endereco, data.rua, data.bairro,
        data.cidade, data.estado, data.telefone, data.cnpj,
        toInt(data.show_itens_pedido), toInt(data.show_valor_total),
        data.print_order, data.print_order_cozinha, data.print_order_entregador,
        parseFloat(data.taxa_servico_padrao) || 0, data.calculo_pizza ?? 'maior',
        parseInt(data.historico_pedidos_limite) ?? 10,
        data.impressora_caminho ?? 'COM1', data.impressora_tipo ?? 'serial',
        data.print_font_size ?? 'Normal'
    ];

    database.run(sql, params, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Configurações atualizadas!' });
    });
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); // Salva na pasta 'uploads'
    },
    filename: (req, file, cb) => {
        // Renomeia o arquivo para um nome fixo (ex: logo.png), para ter apenas um
        const extension = path.extname(file.originalname);
        cb(null, 'logo' + extension);
    }
});

const upload = multer({ storage: storage }); // Middleware de upload

// --- Rota POST: Upload do Logo (Apenas Admin) ---
router.post('/upload-logo', ensureAdmin, upload.single('logo'), (req, res) => {
    const database = db();
    
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    // URL para acesso estático (será ajustada no server.js)
    const logoUrl = `/uploads/${req.file.filename}`;

    // Atualiza a URL no banco de dados
    const sql = `UPDATE Configuracoes SET logo_url = ? WHERE id = 1`;
    database.run(sql, [logoUrl], function(err) {
        if (err) {
            console.error("Erro ao salvar URL do logo:", err.message);
            return res.status(500).json({ error: 'Logo enviado, mas erro ao salvar URL no DB.' });
        }
        res.json({ message: 'Logo enviado e URL salva!', logo_url: logoUrl });
    });
});

router.post('/test-print', ensureAdmin, async (req, res) => {
    const database = db();
    const { formatarPedidoParaImpressao } = require('../services/printFormatter');
    const fs = require('fs');
    const path = require('path');
    const { exec } = require('child_process');

    database.get("SELECT * FROM Configuracoes WHERE id = 1", [], async (err, config) => {
        if (err) return res.status(500).send("Erro ao buscar config");
        const reqLayoutType = req.body.layoutType || 'geral';

        // Simula um pedido fictício para o teste
        const pedidoTeste = {
            id: "999",
            cliente_nome: "TESTE DE IMPRESSÃO",
            cliente_telefone: "(00) 00000-0000",
            endereco_entrega: "Rua Exemplo, 123",
            complemento_entrega: "Apto 45",
            valor_total: 99.90,
            forma_pagamento: "TESTE PIX",
            observacao: "Teste de impressão do sistema",
            itens: [
                { quantidade: 1, nome: "PIZZA TESTE 01", valor: 49.95, observacao: "Sem cebola" },
                { quantidade: 1, nome: "PIZZA TESTE 02", valor: 49.95 }
            ]
        };

        try {
            const buffer = await formatarPedidoParaImpressao(pedidoTeste, config, reqLayoutType);
            
            const tempFile = path.join(__dirname, '..', `teste_print_${Date.now()}.bin`);
            fs.writeFileSync(tempFile, buffer);
            
            if (!config.impressora_caminho) throw new Error("Caminho da impressora não configurado");

            const comando = `copy /b "${tempFile}" "${config.impressora_caminho}"`;
            console.log(`[Teste Impressão] Executando envio Raw: ${comando}`);

            exec(comando, (err, stdout, stderr) => {
                try { fs.unlinkSync(tempFile); } catch(e) {}
                
                if (err) {
                    console.error('[Teste Impressão] Erro ao enviar:', err.message);
                    return res.status(500).json({ error: "Falha ao enviar comando para o Windows", details: err.message });
                }
                res.json({ message: "Comando de teste enviado com sucesso!" });
            });

        } catch (e) {
            console.error("Erro no test-print:", e);
            res.status(500).json({ error: "Erro interno", details: e.message });
        }
    });
});

// --- Endpoint para listar impressoras do Windows ---
router.get('/printers', ensureAdmin, (req, res) => {
    const { exec } = require('child_process');
    const comando = `powershell -Command "@(Get-Printer | Select-Object -Property Name, Shared, ShareName) | ConvertTo-Json"`;
    
    exec(comando, (err, stdout, stderr) => {
        if (err) {
            console.error('Erro ao listar impressoras:', err.message);
            return res.status(500).json({ error: 'Erro ao listar impressoras.', details: err.message });
        }
        try {
            let printers = JSON.parse(stdout);
            if (!Array.isArray(printers)) {
                printers = printers ? [printers] : [];
            }
            
            let printerNames = [];
            printers.forEach(p => {
                if (p.Name) printerNames.push(p.Name);
                if (p.Shared && p.ShareName) {
                    printerNames.push(`\\\\localhost\\${p.ShareName}`);
                }
            });
            
            // Remove duplicatas se houver
            printerNames = [...new Set(printerNames)].filter(Boolean);
            
            res.json({ printers: printerNames });
        } catch (e) {
            console.error('Erro ao parsear impressoras:', e.message);
            // Fallback de erro
            res.json({ printers: [] });
        }
    });
});

// --- Rota DELETE: Limpar Banco de Dados (Apenas Admin, para testes) ---
router.delete('/limpar-banco', ensureAdmin, (req, res) => {
    const database = db();

    try {
        // Ordem importa por causa de foreign keys: limpar filhos antes dos pais
        database.run('DELETE FROM HistoricoPagamentoEntregador', [], () => {});
        database.run('DELETE FROM HistoricoEntrega', [], () => {});
        database.run('DELETE FROM HistoricoFluxoCaixa', [], () => {});
        database.run('DELETE FROM FluxoCaixa', [], () => {});
        database.run('DELETE FROM PedidoPagamento', [], () => {});
        database.run('DELETE FROM ItemPedido', [], () => {});
        database.run('DELETE FROM Pedido', [], () => {});
        database.run('DELETE FROM Cliente', [], () => {});
        database.run('DELETE FROM Entregador', [], () => {});
        database.run('DELETE FROM Mesa', [], () => {});
        database.run('DELETE FROM ModosDePagamento', [], () => {});
        database.run('DELETE FROM Produto', [], () => {});

        // Reinsere os dados iniciais essenciais
        database.run("INSERT OR IGNORE INTO ModosDePagamento (nome) VALUES (?)", ['Dinheiro'], () => {});
        database.run("INSERT OR IGNORE INTO ModosDePagamento (nome) VALUES (?)", ['Cartão (Débito)'], () => {});
        database.run("INSERT OR IGNORE INTO ModosDePagamento (nome) VALUES (?)", ['Cartão (Crédito)'], () => {});
        database.run("INSERT OR IGNORE INTO ModosDePagamento (nome) VALUES (?)", ['Pix'], () => {});

        for (let i = 1; i <= 10; i++) {
            const num = String(i).padStart(2, '0');
            database.run("INSERT OR IGNORE INTO Mesa (numero, status) VALUES (?, ?)", [num, 'Livre'], () => {});
        }

        console.log('🗑️ Banco de dados limpo com sucesso (usuários e configurações preservados).');
        res.json({ message: 'Banco de dados limpo com sucesso! Cardápio, clientes, pedidos, entregadores, mesas, modos de pagamento e históricos foram removidos. Usuários e configurações foram mantidos.' });
    } catch (err) {
        console.error('❌ Erro ao limpar banco de dados:', err.message);
        res.status(500).json({ error: 'Erro ao limpar banco de dados: ' + err.message });
    }
});

module.exports = router;