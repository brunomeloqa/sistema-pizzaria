// database.js
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { hashPassword } = require('./utils/hash');

const isPacked = process.pkg;
const dbFilePath = isPacked
    ? path.join(path.dirname(process.execPath), 'pizzaria-server', 'database.db')
    : path.join(__dirname, 'database.db');

let db;

const initDatabase = async () => {
    // Garantir que a pasta pai do banco de dados exista (especialmente no exe empacotado)
    const dbDir = path.dirname(dbFilePath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    // EXTRAÇÃO DE WASM: Como o pkg tem dificuldade de carregar o .wasm internamente em alguns casos,
    // extraímos ele para a pasta de dados externa no primeiro uso.
    const internalWasmPath = path.join(__dirname, 'sql-wasm-asset.wasm');
    const externalWasmPath = path.join(dbDir, 'sql-wasm.wasm');

    if (isPacked && !fs.existsSync(externalWasmPath)) {
        try {
            const wasmBuffer = fs.readFileSync(internalWasmPath);
            fs.writeFileSync(externalWasmPath, wasmBuffer);
            console.log("✅ Motor do banco de dados extraído para o disco local.");
        } catch (e) {
            console.error("❌ Falha crítica ao extrair WASM:", e.message);
        }
    }

    // Se estiver empacotado, usa o arquivo extraído. Senão, usa o original do node_modules.
    const finalWasmPath = isPacked ? externalWasmPath : internalWasmPath;

    const SQL = await initSqlJs({
        locateFile: file => finalWasmPath
    });

    let filebuffer = null;

    // LÓGICA DE EXTRAÇÃO DO BANCO INICIAL SE NÃO EXISTIR NO DISCO
    if (!fs.existsSync(dbFilePath)) {
        if (isPacked) {
            try {
                // Tenta ler o banco de dados bundled (asset)
                const internalDbPath = path.join(__dirname, 'database.db');
                if (fs.existsSync(internalDbPath)) {
                    filebuffer = fs.readFileSync(internalDbPath);
                    fs.writeFileSync(dbFilePath, filebuffer);
                    console.log("✅ Banco de dados inicial extraído do executável para o disco.");
                }
            } catch (e) {
                console.error("⚠️ Aviso: Não foi possível extrair o banco asset:", e.message);
            }
        }
    } else {
        // Se já existe no disco, apenas lê
        filebuffer = fs.readFileSync(dbFilePath);
    }

    db = new SQL.Database(filebuffer);

    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS Produto (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            descricao TEXT,
            preco REAL NOT NULL,
            preco_broto REAL DEFAULT 0,
            categoria TEXT NOT NULL,
            is_taxa INTEGER DEFAULT 0,
            ativo INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS Cliente (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            telefone TEXT UNIQUE,
            celular TEXT,
            endereco TEXT,
            bairro TEXT,
            numero TEXT,
            CEP TEXT,
            complemento TEXT,
            observacao TEXT,
            total_pedidos INT DEFAULT 0,
            pedidos_pendentes INT DEFAULT 0,
            valor_pendente DECIMAL(10,2) DEFAULT 0.00,
            ativo INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS ModosDePagamento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            ativo INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS Pedido (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER,
            nome_cliente TEXT,
            data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'Pendente',
            valor_total REAL NOT NULL,
            desconto REAL DEFAULT 0,
            modo_pagamento_id INTEGER,
            observacao TEXT, 
            endereco_entrega TEXT,
            complemento_entrega TEXT,
            mesa_id INTEGER,
            parent_id INTEGER,
            pessoas_mesa INTEGER DEFAULT 1,
            taxa_servico_padrao REAL DEFAULT 10,
            tipo TEXT DEFAULT 'Balcão',
            entregador_id INTEGER,
            FOREIGN KEY (cliente_id) REFERENCES Cliente(id),
            FOREIGN KEY (entregador_id) REFERENCES Entregador(id),
            FOREIGN KEY(modo_pagamento_id) REFERENCES ModosDePagamento(id)
        );
        
        CREATE TABLE IF NOT EXISTS ItemPedido (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER,
            produto_id INTEGER,
            quantidade INTEGER NOT NULL,
            observacao TEXT,
            nome TEXT, 
            valor REAL,
            endereco_entrega TEXT,
            complemento_entrega TEXT,
            FOREIGN KEY (pedido_id) REFERENCES Pedido(id),
            FOREIGN KEY (produto_id) REFERENCES Produto(id)
        );

        CREATE TABLE IF NOT EXISTS Usuario (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            password TEXT NOT NULL,
            username TEXT NOT NULL UNIQUE,
            role TEXT NOT NULL DEFAULT 'atendente' 
        );

        CREATE TABLE IF NOT EXISTS Configuracoes (
            id INTEGER PRIMARY KEY DEFAULT 1,
            nome_pizzaria TEXT,
            endereco TEXT,
            rua TEXT,
            bairro TEXT,
            cidade TEXT,
            estado TEXT,
            telefone TEXT,
            cnpj TEXT,
            logo_url TEXT,
            show_itens_pedido TEXT,
            show_valor_itens TEXT,
            show_valor_total TEXT, 
            show_modo_pagamento TEXT,
            show_observacao TEXT,
            show_dados_cliente TEXT, 
            show_num_pedido TEXT,
            via_cozinha INTEGER DEFAULT 1,
            via_cliente INTEGER DEFAULT 1,
            auto_print INTEGER DEFAULT 0,
            footer_message TEXT,
            calculo_pizza TEXT DEFAULT 'maior',
            taxa_servico_padrao REAL DEFAULT 10,
            print_order TEXT DEFAULT 'num_pedido,dados_cliente,itens_pedido,valor_total,modo_pagamento,observacao',
            print_order_cozinha TEXT DEFAULT 'num_pedido,itens_pedido,observacao',
            print_order_entregador TEXT DEFAULT 'num_pedido,dados_cliente,itens_pedido,valor_total,modo_pagamento,observacao',
            historico_pedidos_limite INTEGER DEFAULT 10,
            impressora_caminho TEXT DEFAULT 'COM1',
            impressora_tipo TEXT DEFAULT 'serial',
            print_font_size TEXT DEFAULT 'Normal'
        );

        CREATE TABLE IF NOT EXISTS Mesa (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero INTEGER NOT NULL UNIQUE,
            status TEXT DEFAULT 'Livre'
        );
    
        CREATE TABLE IF NOT EXISTS FluxoCaixa (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT CHECK(tipo IN ('Abertura', 'Entrada', 'Saída', 'Sangria', 'Suprimento', 'Fechamento')),
            valor REAL NOT NULL,
            metodo_pagamento_id INTEGER, -- NULL para Sangria/Suprimento de dinheiro físico
            descricao TEXT,
            data_movimentacao DATETIME DEFAULT (datetime('now', '-3 hours')),
            usuario_id INTEGER,
            FOREIGN KEY (metodo_pagamento_id) REFERENCES ModosDePagamento(id)
        );

        CREATE TABLE IF NOT EXISTS HistoricoFluxoCaixa (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT,
            valor REAL,
            metodo_pagamento_id INTEGER,
            descricao TEXT,
            data_movimentacao DATETIME DEFAULT (datetime('now', '-3 hours')),
            data_fechamento DATETIME DEFAULT (datetime('now', '-3 hours'))
        );

        CREATE TABLE IF NOT EXISTS Entregador (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            contato TEXT,
            quantidade_entregas_dia INTEGER DEFAULT 0,
            saldo REAL DEFAULT 0,
            ativo INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS HistoricoEntrega (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entregador_id INTEGER,
            pedido_id INTEGER,
            valor_taxa REAL,
            data_hora DATETIME DEFAULT (datetime('now', '-3 hours')),
            FOREIGN KEY (entregador_id) REFERENCES Entregador(id)
        );

        CREATE TABLE IF NOT EXISTS HistoricoPagamentoEntregador (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entregador_id INTEGER,
            valor REAL,
            data_pagamento DATETIME DEFAULT (datetime('now', '-3 hours')),
            FOREIGN KEY (entregador_id) REFERENCES Entregador(id)
        );

        CREATE TABLE IF NOT EXISTS PedidoPagamento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER,
            metodo_pagamento_id INTEGER,
            valor REAL NOT NULL,
            data_pagamento DATETIME DEFAULT (datetime('now', '-3 hours')),
            FOREIGN KEY (pedido_id) REFERENCES Pedido(id),
            FOREIGN KEY (metodo_pagamento_id) REFERENCES ModosDePagamento(id)
        );

        CREATE TABLE IF NOT EXISTS Perfil (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            telas TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS CupomPendente (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER,
            cliente_id INTEGER,
            cliente_nome TEXT,
            valor REAL NOT NULL,
            valor_original REAL NOT NULL,
            descricao TEXT,
            status TEXT DEFAULT 'Pendente',
            metodo_baixa_id INTEGER,
            data_criacao DATETIME DEFAULT (datetime('now', '-3 hours')),
            data_baixa DATETIME,
            FOREIGN KEY (pedido_id) REFERENCES Pedido(id),
            FOREIGN KEY (cliente_id) REFERENCES Cliente(id)
        );

        CREATE TABLE IF NOT EXISTS RascunhoPedido (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            identificacao TEXT NOT NULL,
            dados_json TEXT NOT NULL,
            data_atualizacao DATETIME DEFAULT (datetime('now', 'localtime'))
        );
    `);

    // Migrações manuais via JS (para bancos existentes)
    try {
        db.run("ALTER TABLE HistoricoPagamentoEntregador ADD COLUMN descricao TEXT");
        console.log("✅ Coluna 'descricao' em HistoricoPagamentoEntregador adicionada com sucesso.");
    } catch (e) { }

    try {
        db.run("ALTER TABLE Configuracoes ADD COLUMN taxa_servico_padrao REAL DEFAULT 10");
        console.log("✅ Coluna 'taxa_servico_padrao' em Configuracoes verificada.");
    } catch (e) { }

    try {
        db.run("ALTER TABLE Configuracoes ADD COLUMN calculo_pizza TEXT DEFAULT 'maior'");
        console.log("✅ Coluna 'calculo_pizza' em Configuracoes verificada.");
    } catch (e) { }

    try {
        db.run("ALTER TABLE Configuracoes ADD COLUMN show_itens_pedido TEXT");
    } catch (e) { }

    try {
        db.run("ALTER TABLE Configuracoes ADD COLUMN show_valor_total TEXT");
    } catch (e) { }

    try {
        db.run("ALTER TABLE Configuracoes ADD COLUMN print_order TEXT");
    } catch (e) { }

    try {
        db.run("ALTER TABLE Configuracoes ADD COLUMN print_order_cozinha TEXT");
    } catch (e) { }

    try {
        db.run("ALTER TABLE Pedido ADD COLUMN desconto REAL DEFAULT 0");
        console.log("✅ Coluna 'desconto' em Pedido adicionada com sucesso.");
    } catch (e) { }

    try {
        db.run("ALTER TABLE Pedido ADD COLUMN nome_cliente TEXT");
        console.log("✅ Coluna 'nome_cliente' em Pedido adicionada com sucesso.");
    } catch (e) { }

    try {
        db.run("ALTER TABLE Pedido ADD COLUMN tipo TEXT DEFAULT 'Balcão'");
        console.log("✅ Coluna 'tipo' em Pedido adicionada com sucesso.");
    } catch (e) { }

    try {
        db.run("ALTER TABLE Entregador ADD COLUMN saldo REAL DEFAULT 0");
        console.log("✅ Coluna 'saldo' em Entregador adicionada com sucesso.");
    } catch (e) { }

    try {
        db.run("ALTER TABLE Produto ADD COLUMN is_taxa INTEGER DEFAULT 0");
        console.log("✅ Coluna 'is_taxa' em Produto adicionada com sucesso.");
    } catch (e) { }

    try {
        db.run("ALTER TABLE Configuracoes ADD COLUMN print_order_entregador TEXT DEFAULT 'num_pedido,dados_cliente,itens_pedido,valor_total,modo_pagamento,observacao'");
        console.log("✅ Colunas de layouts de impressão adicionadas com sucesso.");
    } catch (e) { }

    try {
        db.run("ALTER TABLE Pedido ADD COLUMN entregador_id INTEGER");
        console.log("✅ Coluna 'entregador_id' em Pedido adicionada com sucesso.");
    } catch (e) { }

    try {
        db.run("ALTER TABLE Pedido ADD COLUMN parent_id INTEGER");
        console.log("✅ Coluna 'parent_id' em Pedido adicionada com sucesso.");
    } catch (e) { }

    try {
        db.run("ALTER TABLE Usuario ADD COLUMN perfil_id INTEGER");
        console.log("✅ Coluna 'perfil_id' em Usuario adicionada com sucesso.");
    } catch (e) { }

    try {
        db.run("ALTER TABLE Configuracoes ADD COLUMN historico_pedidos_limite INTEGER DEFAULT 10");
        console.log("✅ Coluna 'historico_pedidos_limite' em Configuracoes adicionada com sucesso.");
    } catch (e) { }

    try {
        db.run("ALTER TABLE Configuracoes ADD COLUMN impressora_caminho TEXT DEFAULT 'COM1'");
    } catch (e) { }

    try {
        db.run("ALTER TABLE Configuracoes ADD COLUMN impressora_tipo TEXT DEFAULT 'serial'");
    } catch (e) { }

    try {
        db.run("ALTER TABLE Configuracoes ADD COLUMN print_font_size TEXT DEFAULT 'Normal'");
    } catch (e) { }

    // Migração: coluna is_cupom em ModosDePagamento
    try {
        db.run("ALTER TABLE ModosDePagamento ADD COLUMN is_cupom INTEGER DEFAULT 0");
        console.log("✅ Coluna 'is_cupom' em ModosDePagamento adicionada com sucesso.");
    } catch (e) { }

    // Migração: tabela CupomPendente (para bancos existentes)
    try {
        db.run(`CREATE TABLE IF NOT EXISTS CupomPendente (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER,
            cliente_id INTEGER,
            cliente_nome TEXT,
            valor REAL NOT NULL,
            valor_original REAL NOT NULL,
            descricao TEXT,
            status TEXT DEFAULT 'Pendente',
            metodo_baixa_id INTEGER,
            data_criacao DATETIME DEFAULT (datetime('now', 'localtime')),
            data_baixa DATETIME,
            FOREIGN KEY (pedido_id) REFERENCES Pedido(id),
            FOREIGN KEY (cliente_id) REFERENCES Cliente(id)
        )`);
        console.log("✅ Tabela 'CupomPendente' verificada/criada.");
    } catch (e) { }

    // Migração para criar PedidoPagamento se não existir
    try {
        db.run(`CREATE TABLE IF NOT EXISTS PedidoPagamento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER,
            metodo_pagamento_id INTEGER,
            valor REAL NOT NULL,
            data_pagamento DATETIME DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (pedido_id) REFERENCES Pedido(id),
            FOREIGN KEY (metodo_pagamento_id) REFERENCES ModosDePagamento(id)
        )`);
        console.log("✅ Tabela 'PedidoPagamento' verificada/criada.");
    } catch (e) { }

    // Migração: tabela RascunhoPedido
    try {
        db.run(`CREATE TABLE IF NOT EXISTS RascunhoPedido (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            identificacao TEXT NOT NULL,
            dados_json TEXT NOT NULL,
            data_atualizacao DATETIME DEFAULT (datetime('now', 'localtime'))
        )`);
        console.log("✅ Tabela 'RascunhoPedido' verificada/criada.");
    } catch (e) { }

    db.run("INSERT OR IGNORE INTO Configuracoes (id, nome_pizzaria) VALUES (?, ?)", [1, 'Sua Pizzaria Aqui']);

    const configExists = db.exec("SELECT COUNT(*) FROM Configuracoes WHERE id = 1");
    if (configExists.length > 0 && configExists[0].values[0][0] >= 1) {
        db.run(`
            UPDATE Configuracoes SET 
                show_itens_pedido = COALESCE(show_itens_pedido, 1),
                show_valor_itens = COALESCE(show_valor_itens, 1),
                show_valor_total = COALESCE(show_valor_total, 1),
                show_modo_pagamento = COALESCE(show_modo_pagamento, 1),
                show_observacao = COALESCE(show_observacao, 1),
                show_dados_cliente = COALESCE(show_dados_cliente, 1),
                show_num_pedido = COALESCE(show_num_pedido, 1),
                via_cozinha = COALESCE(via_cozinha, 1),
                via_cliente = COALESCE(via_cliente, 1),
                taxa_servico_padrao = COALESCE(taxa_servico_padrao, 5),
                calculo_pizza = COALESCE(calculo_pizza, 'maior')
            WHERE id = 1
        `);
    }

    // Insert initial payment methods
    const paymentResult = db.exec("SELECT COUNT(*) AS count FROM ModosDePagamento");
    if (paymentResult.length === 0 || paymentResult[0].values[0][0] === 0) {
        db.run("INSERT INTO ModosDePagamento (nome) VALUES (?)", ['Dinheiro']);
        db.run("INSERT INTO ModosDePagamento (nome) VALUES (?)", ['Cartão (Débito)']);
        db.run("INSERT INTO ModosDePagamento (nome) VALUES (?)", ['Cartão (Crédito)']);
        db.run("INSERT INTO ModosDePagamento (nome) VALUES (?)", ['Pix']);
        console.log("✅ Modos de Pagamento iniciais inseridos.");
    }

    // Insert default profiles
    const allTelas = '["FLUXO_CAIXA","NOVO_PEDIDO","MONITOR_COZINHA","SALAO","ADMIN_CLIENTES","ADMIN_PRODUTOS","ADMIN_ENTREGADORES","CUPONS","ADMIN_RELATORIOS","ADMIN_CONFIG"]';
    const atendentesTelas = '["FLUXO_CAIXA","NOVO_PEDIDO","MONITOR_COZINHA","SALAO","ADMIN_CLIENTES","CUPONS"]';
    const cozinhaTelas = '["MONITOR_COZINHA"]';

    const perfilResult = db.exec("SELECT COUNT(*) AS count FROM Perfil");
    if (perfilResult.length === 0 || perfilResult[0].values[0][0] === 0) {
        db.run("INSERT INTO Perfil (nome, telas) VALUES (?, ?)", ['admin', allTelas]);
        db.run("INSERT INTO Perfil (nome, telas) VALUES (?, ?)", ['atendente', atendentesTelas]);
        db.run("INSERT INTO Perfil (nome, telas) VALUES (?, ?)", ['cozinha', cozinhaTelas]);
        console.log("✅ Perfis padrão criados (admin, atendente, cozinha).");
    }

    // Migração: adiciona CUPONS ao perfil admin existente (se já existir)
    try {
        const perfilAdmin = db.exec("SELECT telas FROM Perfil WHERE nome = 'admin' LIMIT 1");
        if (perfilAdmin.length > 0 && perfilAdmin[0].values[0][0]) {
            const telasAtuais = JSON.parse(perfilAdmin[0].values[0][0]);
            if (!telasAtuais.includes('CUPONS')) {
                telasAtuais.push('CUPONS');
                db.run("UPDATE Perfil SET telas = ? WHERE nome = 'admin'", [JSON.stringify(telasAtuais)]);
                console.log("✅ Tela CUPONS adicionada ao perfil admin.");
            }
        }
    } catch (e) { console.log('Migração perfil admin CUPONS:', e.message); }

    // Insert initial admin user
    const userResult = db.exec("SELECT COUNT(*) AS count FROM Usuario");
    if (userResult.length === 0 || userResult[0].values[0][0] === 0) {
        try {
            const hashedPassword = await hashPassword('admin');
            db.run("INSERT INTO Usuario (username, password, role, perfil_id) VALUES (?, ?, ?, ?)", ['admin', hashedPassword, 'admin', 1]);
            console.log("✅ Usuário admin criado com sucesso!");
        } catch (error) {
            console.error("❌ Erro ao criar usuário admin:", error.message);
        }
    }

    // Migrar usuários existentes sem perfil_id
    try {
        const usersNoPerfil = db.exec("SELECT id, role FROM Usuario WHERE perfil_id IS NULL");
        if (usersNoPerfil.length > 0 && usersNoPerfil[0].values.length > 0) {
            const perfis = db.exec("SELECT id, nome FROM Perfil");
            const perfilMap = {};
            if (perfis.length > 0) {
                perfis[0].values.forEach(row => { perfilMap[row[1]] = row[0]; });
            }
            usersNoPerfil[0].values.forEach(row => {
                const userId = row[0];
                const role = row[1];
                const perfilId = perfilMap[role] || perfilMap['atendente'] || 2;
                db.run("UPDATE Usuario SET perfil_id = ? WHERE id = ?", [perfilId, userId]);
            });
            console.log("✅ Usuários migrados para perfil_id.");
        }
    } catch (e) { console.log('Migração perfil_id:', e.message); }

    

    const mesaInicial = db.exec("SELECT COUNT(*) AS count FROM Mesa");
    if (mesaInicial.length === 0 || mesaInicial[0].values[0][0] === 0) {
        db.run("INSERT INTO Mesa (numero, status) VALUES (?, ?)", ['01', 'Livre']);
        db.run("INSERT INTO Mesa (numero, status) VALUES (?, ?)", ['02', 'Livre']);
        db.run("INSERT INTO Mesa (numero, status) VALUES (?, ?)", ['03', 'Livre']);
        db.run("INSERT INTO Mesa (numero, status) VALUES (?, ?)", ['04', 'Livre']);
        db.run("INSERT INTO Mesa (numero, status) VALUES (?, ?)", ['05', 'Livre']);
        db.run("INSERT INTO Mesa (numero, status) VALUES (?, ?)", ['06', 'Livre']);
        db.run("INSERT INTO Mesa (numero, status) VALUES (?, ?)", ['07', 'Livre']);
        db.run("INSERT INTO Mesa (numero, status) VALUES (?, ?)", ['08', 'Livre']);
        db.run("INSERT INTO Mesa (numero, status) VALUES (?, ?)", ['09', 'Livre']);
        db.run("INSERT INTO Mesa (numero, status) VALUES (?, ?)", ['10', 'Livre']);

        console.log("✅ Mesas inciais adicionas");
    }

    saveDatabase();
    console.log('✅ Conectado ao banco de dados SQLite.');
    console.log("✅ Banco de dados e tabelas verificadas.");

    return db;
};

const saveDatabase = () => {
    if (db) {
        try {
            const data = db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(dbFilePath, buffer);
            // console.log("💾 Banco de dados persistido no disco.");
        } catch (err) {
            console.error("❌ ERRO AO SALVAR BANCO DE DADOS NO DISCO:", err.message);
            console.error("Caminho tentado:", dbFilePath);
        }
    }
};

// === WRAPPER PARA COMPATIBILIDADE COM sqlite3 ===
const dbWrapper = {
    run: (sql, params = [], callback) => {
        try {
            const stmt = db.prepare(sql);
            stmt.bind(params);
            stmt.step();
            const lastID = db.exec("SELECT last_insert_rowid() AS id")[0]?.values[0][0]; // Captura o lastID
            stmt.free();
            saveDatabase();
            if (callback) {
                callback.call({ changes: 1, lastID }, null); // Retorna o lastID correto
            }
        } catch (err) {
            console.error("❌ ERRO SQL (run):", err.message);
            console.error("SQL:", sql);
            console.error("Params:", params);
            if (callback) callback(err);
        }
    },

    get: (sql, params = [], callback) => {
        try {
            const stmt = db.prepare(sql);
            stmt.bind(params);
            let row = null;
            if (stmt.step()) {
                const columns = stmt.getColumnNames();
                const values = stmt.get();
                row = {};
                columns.forEach((col, idx) => {
                    row[col] = values[idx];
                });
            }
            stmt.free();
            if (callback) callback(null, row);
        } catch (err) {
            if (callback) callback(err);
        }
    },

    all: (sql, params = [], callback) => {
        try {
            const stmt = db.prepare(sql);
            stmt.bind(params);
            let rows = [];
            const columns = stmt.getColumnNames();
            while (stmt.step()) {
                const values = stmt.get();
                const row = {};
                columns.forEach((col, idx) => {
                    row[col] = values[idx];
                });
                rows.push(row);
            }
            stmt.free();
            if (callback) callback(null, rows);
        } catch (err) {
            if (callback) callback(err);
        }
    },

    prepare: (sql) => {
        return {
            run: (...args) => {
                const callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;
                const params = args;
                try {
                    const stmt = db.prepare(sql);
                    stmt.bind(params);
                    stmt.step();
                    stmt.free();
                    saveDatabase();
                    if (callback) {
                        callback.call({ changes: 1, lastID: null }, null);
                    }
                } catch (err) {
                    if (callback) callback(err);
                }
            },
            finalize: () => { }
        };
    },

    serialize: (callback) => {
        if (callback) callback();
    }
};

setInterval(saveDatabase, 5000);
process.on('exit', saveDatabase);

module.exports = { initDatabase, db: () => dbWrapper, saveDatabase };
