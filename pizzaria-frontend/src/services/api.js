// src/services/api.js
import axios from 'axios';

const BASE_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000/api' 
    : '/api';

const apiClient = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Interceptor para adicionar token em TODAS as requisições
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        console.log('✅ Interceptor: token disponível?', !!token);
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
            console.log('✅ Header Authorization adicionado');
        } else {
            console.warn('⚠️ Nenhum token encontrado em localStorage');
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Interceptor para tratar respostas 401 (token expirado)
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            console.error('❌ Token expirado ou inválido. Fazendo logout...');
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            window.location.href = '/login'; // Redirecionar para login
        }
        return Promise.reject(error);
    }
);

export const apiService = {
    login: (credentials) => apiClient.post('/auth/login', credentials),
    
    //Caixa
    registrarMovimentacaoCaixa: (data) => apiClient.post('/caixa/movimentar', data),
    getSaldoCaixa: () => apiClient.get('/caixa/saldo-atual'),
    getRelatorioCaixa: () => apiClient.get('/caixa/relatorio-fechamento'),
    postFecharCaixa: (data) => apiClient.post('/caixa/fechar-caixa', data),
    imprimirRelatorioCaixa: (data) => apiClient.post('/caixa/imprimir', data),

    // Pedidos
    listarPedidos: () => apiClient.get('/pedidos'),
    buscarPedidoDetalhes: (id) => apiClient.get(`/pedidos/${id}/detail`),
    criarPedido: (data) => apiClient.post('/pedidos', data),
    atualizarStatusPedido: (id, status) => apiClient.put(`/pedidos/${id}/status`, { status }),
    lancarItens: (comandaId, itens) => apiClient.post(`/pedidos/${comandaId}/itens`, { itens }),
    getPedidoDetalhes: (id) => apiClient.get(`/pedidos/${id}`),

    // Mesas
    listarMesas: () => apiClient.get('/mesas'),
    getStatusSalao: () => apiClient.get('/mesas/status-salao'),
    criarMesa: (data) => apiClient.post('/mesas', data),
    deletarMesa: (id) => apiClient.delete(`/mesas/${id}`),
    abrirContaMesa: (data) => apiClient.post('/mesas/abrir-conta', data),
    fecharContaMesa: (data) => apiClient.post('/mesas/fechar-conta', data),
    adicionarItemMesa: (data) => apiClient.post('/pedidos/adicionar-item', data),
    removerItemPedido: (id) => apiClient.delete(`/pedidos/remover-item/${id}`),
    transferirMesa: (data) => apiClient.post('/mesas/transferir', data),
    finalizarPedido: (data) => apiClient.post('/pedidos/finalizar-pedido', data), // <--- Faltava essa também!
    
    // Clientes
    listarClientes: () => apiClient.get('/clientes'),
    buscarClientePorTelefone: (tel) => apiClient.get('/clientes/busca', { params: { tel } }),
    criarCliente: (data) => apiClient.post('/clientes', data),
    cadastrarCliente: (data) => apiClient.post('/clientes', data), // Alias para compatibilidade
    atualizarCliente: (id, data) => apiClient.put(`/clientes/${id}`, data),
    deletarCliente: (id) => apiClient.delete(`/clientes/${id}`),
    exportarClientesCSV: () => apiClient.get('/clientes/exportar', { responseType: 'blob' }),
    importarClientesCSV: (formData) => apiClient.post('/clientes/importar', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    
    // Produtos
    listarProdutos: (filtros = {}) => apiClient.get('/produtos', { params: filtros }),
    criarProduto: (data) => apiClient.post('/produtos', data), // <--- Padronize para 'criarProduto'
    atualizarProduto: (id, data) => apiClient.put(`/produtos/${id}`, data),
    removerProduto: (id) => apiClient.delete(`/produtos/${id}`),
    exportarProdutosCSV: () => apiClient.get('/produtos/exportar', { responseType: 'blob' }),
    importarProdutosCSV: (formData) => apiClient.post('/produtos/importar', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    
    // Modos de Pagamento
    listarModosPagamento: () => apiClient.get('/payment-methods'),
    addPaymentMethod: (data) => apiClient.post('/payment-methods', data),
    deletePaymentMethod: (id) => apiClient.delete(`/payment-methods/${id}`),
    updatePaymentMethod: (id, data) => apiClient.put(`/payment-methods/${id}`, data),
    
    // Configurações
    getConfiguracoes: () => apiClient.get('/config'),
    updateConfiguracoes: (data) => apiClient.put('/config', data),
    uploadLogo: (formData) => apiClient.post('/config/upload-logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    
    // Usuários
    listarUsuarios: () => apiClient.get('/users'),
    criarUsuario: (data) => apiClient.post('/users', data),
    deletarUsuario: (id) => apiClient.delete(`/users/${id}`),
    addUser: (data) => apiClient.post('/users', data),
    deleteUser: (id) => apiClient.delete(`/users/${id}`),
    
    // Perfis
    listarPerfis: () => apiClient.get('/perfis'),
    criarPerfil: (data) => apiClient.post('/perfis', data),
    atualizarPerfil: (id, data) => apiClient.put(`/perfis/${id}`, data),
    deletarPerfil: (id) => apiClient.delete(`/perfis/${id}`),
    
    // Relatórios
    getRelatorioMaisVendidos: (periodo, data_inicio, data_fim) => apiClient.get('/pedidos/relatorios/mais-vendidos', { params: { periodo, data_inicio, data_fim } }),
    getRelatorioSaboresPizza: (periodo, data_inicio, data_fim) => apiClient.get('/pedidos/relatorios/sabores-pizza', { params: { periodo, data_inicio, data_fim } }),
    getRelatorioBairros: (periodo, data_inicio, data_fim) => apiClient.get('/pedidos/relatorios/bairros', { params: { periodo, data_inicio, data_fim } }),
    getRelatorioTipoAtendimento: (periodo, data_inicio, data_fim) => apiClient.get('/pedidos/relatorios/tipo-atendimento', { params: { periodo, data_inicio, data_fim } }),
    getRelatorioHorarios: (periodo, data_inicio, data_fim) => apiClient.get('/pedidos/relatorios/horarios', { params: { periodo, data_inicio, data_fim } }),
    getRelatorioPizzasPorDia: (periodo, data_inicio, data_fim) => apiClient.get('/pedidos/relatorios/pizzas-por-dia', { params: { periodo, data_inicio, data_fim } }),
    getRelatorioPizzasPorTamanho: (periodo, data_inicio, data_fim) => apiClient.get('/pedidos/relatorios/pizzas-por-tamanho', { params: { periodo, data_inicio, data_fim } }),
    getRelatorioEntregadores: (periodo, data_inicio, data_fim) => apiClient.get('/entregadores', { params: { periodo, data_inicio, data_fim } }),
    getRelatorioModoPagamento: (periodo, data_inicio, data_fim) => apiClient.get('/pedidos/relatorios/modo-pagamento', { params: { periodo, data_inicio, data_fim } }),

    //Impressora
    testarImpressao: () => apiClient.post('/config/test-print'),

    // Entregadores
    listarEntregadores: () => apiClient.get('/entregadores'),
    criarEntregador: (data) => apiClient.post('/entregadores', data),
    atualizarEntregador: (id, data) => apiClient.put(`/entregadores/${id}`, data),
    deletarEntregador: (id) => apiClient.delete(`/entregadores/${id}`),
    getHistoricoEntregador: (id) => apiClient.get(`/entregadores/${id}/historico`),
    realizarPagamentoEntregador: (id, data) => apiClient.post(`/entregadores/${id}/payout`, data),
    realizarAjusteEntregador: (id, data) => apiClient.post(`/entregadores/${id}/ajuste`, data),

    // Limpeza de banco de dados (modo teste)
    limparBancoDados: () => apiClient.delete('/config/limpar-banco'),

    // Histórico de pedidos por cliente
    getHistoricoCliente: (id, limite = 10) => apiClient.get(`/clientes/${id}/pedidos`, { params: { limite } }),

    // Cupons (Pagamentos Diferidos)
    listarCupons: (filtros) => apiClient.get('/cupons', { params: filtros }),
    darBaixaCupom: (id, data) => apiClient.post(`/cupons/${id}/baixa`, data),
    baixaGeralCupons: (clienteId, data) => apiClient.post('/cupons/baixa-geral', { ...data, cliente_id: clienteId }),
    atualizarMetodoPagamento: (id, data) => apiClient.put(`/payment-methods/${id}`, data),

    // Rascunhos de Pedidos
    listarRascunhos: () => apiClient.get('/pedidos/rascunhos'),
    criarRascunho: (data) => apiClient.post('/pedidos/rascunhos', data),
    atualizarRascunho: (id, data) => apiClient.put(`/pedidos/rascunhos/${id}`, data),
    deletarRascunho: (id) => apiClient.delete(`/pedidos/rascunhos/${id}`),
};


