// D:\Projetos\NodeJS\sistema_pizzaria\test_backend.js

const axios = require('axios');

// --- Configurações ---
const BASE_URL = 'http://localhost:3000/api';
const ADMIN_USER = {
    username: 'admin',
    password: 'admin' // Certifique-se que esta é a senha inicial real
};

// --- Variáveis de Estado (para testes encadeados) ---
let authToken = '';
let clienteId = null;
let produtoId = null;
let modoPagamentoId = null;
let pedidoId = null;

// --- Mock Data ---
const MOCK_CONFIG_UPDATE = {
    nome_pizzaria: 'Pizzaria Teste S.A.',
    endereco: 'Rua das Rotas, 404',
    cnpj: '12.345.678/0001-90',
    logo_url: '/uploads/logo.png',
    // 🚨 CAMPOS CRÍTICOS (USE STRING '1' OU '0' SE SEU FRONTEND SALVA ASSIM)
    show_itens_pedido: '1',
    show_valor_itens: '1',
    show_valor_total: '1',
    show_modo_pagamento: '1',
    show_observacao: '1',
    show_dados_cliente: '1',
    show_num_pedido: '1',
    print_order: JSON.stringify(['num_pedido', 'cliente_nome', 'itens_pedido', 'total_pedido']) // ✅ Deve ser JSON String
};

const MOCK_PRODUTO = {
    nome: 'Pizza Teste Quatro Estações',
    descricao: 'Teste de criação de produto.',
    preco: 55.00,
    categoria: 'Pizzas'
};

const MOCK_CLIENTE = {
    nome: 'Cliente Teste API',
    telefone: '99999999999', // Deve ser UNIQUE
    endereco: 'Rua dos Testes, 100',
    complemento: 'Apto 10',
    observacao: 'Cliente VIP'
};

// --- Função Auxiliar de Requisição ---
const api = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
});

// --- TESTES DE ROTA ---

async function testAuth() {
    console.log('--- 1. Teste de Autenticação ---');
    
    console.log('--- 1.1 Validar login ---');
    try {
        const res = await api.post('/auth/login', ADMIN_USER);
        authToken = res.data.token;

        // 🚨 NOVO LOG CRÍTICO AQUI
        if (!authToken) {
            console.error('❌ ERRO: Login retornou sucesso, mas o campo "token" está vazio ou não existe no retorno!', res.data);
            process.exit(1);
        }

        console.log(`✅ Login Administrador: Sucesso! Token: ${authToken.substring(0, 20)}...`);
    } catch (error) {
        console.error('❌ Falha no Login! Verifique o servidor ou as credenciais.', error.message);
        process.exit(1);
    }
}

async function testConfig() {
    console.log('\n--- 2. Teste de Configurações (/api/config) ---');
    
    // 2.1 GET Configurações
    console.log('--- 2.1 GET Configurações ---');
    try {
        const res = await api.get('/config');
        console.log(`✅ GET Configurações: Sucesso. Nome atual: ${res.data.data.nome_pizzaria}`);
    } catch (error) {
        console.error('❌ Falha no GET Configurações.', error.message);
    }

    // 2.2 PUT Configurações (TESTE CRÍTICO DE ATUALIZAÇÃO)
    console.log('--- 2.2 PUT Configurações ---');
    try {
        const res = await api.put('/config', MOCK_CONFIG_UPDATE, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log(`✅ PUT Configurações: Sucesso! Mensagem: ${res.data.message}`);
        
        // Opcional: Apenas para ver o cabeçalho exato que está sendo enviado
        console.log(`[DEBUG] Enviando PUT com Authorization: Bearer ${authToken.substring(0, 20)}...`);
        
        // 2.3 VERIFICAÇÃO PÓS-PUT
        const verifyRes = await api.get('/config');
        const config = verifyRes.data.data;
        if (config.nome_pizzaria === MOCK_CONFIG_UPDATE.nome_pizzaria && 
            config.show_dados_cliente === MOCK_CONFIG_UPDATE.show_dados_cliente) {
            console.log(`✅ VERIFICAÇÃO: Configurações (incluindo novos campos) foram salvas e lidas corretamente.`);
        } else {
            console.error('❌ VERIFICAÇÃO: Configurações salvas não correspondem ao esperado. Verifique configRoutes.js PUT.');
        }

    } catch (error) {
        console.error('❌ Falha no PUT Configurações. Verifique configRoutes.js PUT.', error.message);
    }
}

async function testMetodosPagamento() {
    console.log('\n--- 3. Teste de Modos de Pagamento (/api/payment-methods) ---');

    // 3.1 POST Novo Método
    console.log('--- 3.1 POST Novo Método ---');
    try {
        const novoMetodo = { nome: 'Teste API', ativo: 1 };
        const res = await api.post('/payment-methods', novoMetodo, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        modoPagamentoId = res.data.id;
        console.log(`✅ POST Modo Pagamento: Sucesso! ID: ${modoPagamentoId}`);
    } catch (error) {
        console.error('❌ Falha no POST Modo Pagamento.', error.message);
    }

    // 3.2 GET ALL Métodos
    console.log('--- 3.2 GET ALL Métodos ---');
    try {
        console.log('[TESTE] Enviando requisição GET ALL Métodos...');
        const res = await api.get('/payment-methods', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log('[TESTE] Resposta recebida:', res.data);
        if (res.data.data.length > 0) { // Corrigido para acessar res.data.data
            console.log(`✅ GET ALL Modos Pagamento: Sucesso. Total: ${res.data.data.length}`);
        } else {
            console.log('⚠️ Nenhum modo de pagamento encontrado.');
        }
    } catch (error) {
        console.error('[TESTE] Falha no GET ALL Modos Pagamento:', error.message);
    }
}

async function testProdutos() {
    console.log('\n--- 4. Teste de Produtos (/api/produtos) ---');

    // 4.1 POST Produto
    console.log('--- 4.1 POST Produto ---');
    try {
        const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const produtoTeste = {
            nome: `Pizza Teste ${dataHora}`,
            descricao: 'Teste de criação de produto.',
            preco: 55,
            categoria: 'Pizzas'
        };
        const res = await api.post('/produtos', produtoTeste, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        produtoId = res.data.data.id;
        console.log(`✅ POST Produto: Sucesso! ID: ${produtoId}`);
    } catch (error) {
        console.error('❌ Falha no POST Produto.', error.message);
    }

    // 4.2 GET ALL Produtos
    console.log('--- 4.2 GET ALL Produtos ---');
    try {
        const res = await api.get('/produtos', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.data.data.length > 0) {
            console.log(`✅ GET ALL Produtos: Sucesso. Total: ${res.data.data.length}`);
        } else {
            console.log('⚠️ Nenhum produto encontrado.');
        }
    } catch (error) {
        console.error('❌ Falha no GET ALL Produtos.', error.message);
    }
}

async function testClientes() {
    console.log('\n--- 5. Teste de Clientes (/api/clientes) ---');

    // 5.1 POST Cliente
    console.log('--- 5.1 POST Cliente ---');
    try {
        const dataHora = new Date().toISOString(); // Gera um timestamp único
        const clienteTeste = {
            nome: 'Cliente Teste',
            telefone: MOCK_CLIENTE.telefone, // Telefone único baseado no timestamp
            endereco: 'Rua Teste, 123',
            complemento: 'Apto 45',
            observacao: 'Teste de criação de cliente.'
        };
        const res = await api.post('/clientes', clienteTeste, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        clienteId = res.data.data.id;
        console.log(`✅ POST Cliente: Sucesso! ID: ${clienteId}`);
    } catch (error) {
        console.error('❌ Falha no POST Cliente.', error.message);
    }

    // Corrigindo a rota para buscar cliente por telefone
    // 5.2 GET Cliente por Telefone
    console.log('--- 5.2 GET Cliente por Telefone ---');
    try {
        const res = await api.get(`/clientes/busca?tel=${MOCK_CLIENTE.telefone}`);
        if (res.data.data.telefone === MOCK_CLIENTE.telefone) {
            console.log(`✅ GET Cliente por Telefone: Sucesso. Nome: ${res.data.data.nome}`);
        }
    } catch (error) {
        console.error('❌ Falha no GET Cliente por Telefone.', error.message);
    }
}

async function testPedidos() {
    console.log('\n--- 6. Teste de Pedidos (/api/pedidos) ---');

    // Requisito: Pelo menos um cliente, um produto e um modo de pagamento devem existir
    if (!clienteId || !produtoId || !modoPagamentoId) {
        console.error('⚠️ ATENÇÃO: Pulando testes de Pedidos. Falta Cliente, Produto ou Modo de Pagamento.');
        return;
    }
    
    // 6.1 POST Novo Pedido
    console.log('--- 6.1 POST Novo Pedido ---');
    try {
        const novoPedido = {
            cliente_id: clienteId,
            valor_total: 55.00,
            modo_pagamento_id: modoPagamentoId,
            observacao: 'Pedido de Teste API',
            itens: [
                { produto_id: produtoId, nome: MOCK_PRODUTO.nome, quantidade: 1, valor: MOCK_PRODUTO.preco }
            ]
        };

        const res = await api.post('/pedidos', novoPedido, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        pedidoId = res.data.id;
        console.log(`✅ POST Pedido: Sucesso! ID: ${pedidoId}`);
    } catch (error) {
        console.error('❌ Falha no POST Pedido. Verifique se o PedidoRoutes salva os itens corretamente.', error.message);
        console.error('Detalhes do erro:', error.response?.data);
    }

    // Corrigindo a rota para listar pedidos pendentes
    // 6.1 GET ALL Pedidos (Monitor Cozinha)
    console.log('--- 6.1 GET ALL Pedidos (Monitor Cozinha) ---');
    try {
        const res = await api.get('/pedidos/pendentes', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log(`✅ GET ALL Pedidos: Sucesso. Total: ${res.data.data.length}`);
    } catch (error) {
        console.error('❌ Falha no GET ALL Pedidos.', error.message);
    }

    // 6.3 PUT Atualizar Status (Mover para Preparando)
    console.log('--- 6.3 PUT Atualizar Status do Pedido ---');
    if (pedidoId) {
        try {
            const res = await api.put(`/pedidos/${pedidoId}/status`, { status: 'Preparando' }, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            console.log(`✅ PUT Status Pedido: Sucesso! Novo status: Preparando`);
        } catch (error) {
            console.error('❌ Falha no PUT Status Pedido.', error.message);
        }
    }
}

async function testPedidoDetalhes() {
    console.log('\n--- 8. Teste de Detalhes do Pedido (/api/pedidos/:id/detail) ---');

    if (!pedidoId) {
        console.error('⚠️ ATENÇÃO: Pulando teste de detalhes do pedido. Nenhum pedido foi criado.');
        return;
    }

    try {
        const res = await api.get(`/pedidos/${pedidoId}/detail`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log(`✅ GET Detalhes do Pedido: Sucesso! Pedido ID: ${pedidoId}`);
        console.log('Detalhes do Pedido:', res.data);
    } catch (error) {
        console.error('❌ Falha no GET Detalhes do Pedido.', error.message);
        console.error('Detalhes do erro:', error.response?.data || error);
    }
}

async function testCleanup() {
    console.log('\n--- 7. Limpeza (Deletar Dados de Teste) ---');
    try {
        if (pedidoId) await api.delete(`/pedidos/${pedidoId}`, { headers: { Authorization: `Bearer ${authToken}` } });
        if (produtoId) await api.delete(`/produtos/${produtoId}`, { headers: { Authorization: `Bearer ${authToken}` } });
        if (clienteId) await api.delete(`/clientes/${clienteId}`, { headers: { Authorization: `Bearer ${authToken}` } });
        if (modoPagamentoId) await api.delete(`/pagamento/${modoPagamentoId}`, { headers: { Authorization: `Bearer ${authToken}` } });

        console.log('✅ Limpeza de dados de teste (Cliente, Produto, Pedido, Modo Pagamento): Sucesso!');
    } catch (error) {
        console.error('❌ Falha na Limpeza.', error.message);
        console.log('⚠️ Aviso: Dados de teste podem ter permanecido no banco de dados.');
    }

    // Corrigindo a rota para evitar duplicação do prefixo `/api`
    // 7.1 DELETE Limpeza de Pedidos
    console.log('--- 7.1 DELETE Limpeza de Pedidos ---');
    try {
        const res = await api.delete('/api/pedidos/limpeza', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log(`✅ DELETE Limpeza de Pedidos: ${res.data.message}`);

        // Verificar se as tabelas estão vazias
        const tabelas = ['Pedido', 'ModoPagamento', 'Cliente', 'Produto'];
        for (const tabela of tabelas) {
            const countRes = await api.get(`/api/debug/count/${tabela}`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            if (countRes.data.count > 0) {
                console.warn(`⚠️ A tabela ${tabela} ainda contém ${countRes.data.count} registro(s).`);
            } else {
                console.log(`✅ A tabela ${tabela} foi limpa com sucesso.`);
            }
        }
    } catch (error) {
        console.error('❌ Falha na Limpeza.', error.message);
    }
}

async function runTests() {
    console.log('==============================================');
    console.log('🚀 INICIANDO TESTES DA API DO SISTEMA PIZZARIA');
    console.log('==============================================');
    
    await testAuth();
    await testConfig();
    await testMetodosPagamento();
    await testProdutos();
    await testClientes();
    await testPedidos();
    await testPedidoDetalhes(); // Adicionado o teste de detalhes do pedido
    await testCleanup();

    console.log('\n==============================================');
    console.log('🏁 TESTES CONCLUÍDOS. VERIFIQUE OS LOGS ACIMA.');
    console.log('==============================================');
}

runTests();