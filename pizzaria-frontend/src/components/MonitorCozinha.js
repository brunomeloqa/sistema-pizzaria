// src/components/MonitorCozinha.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/api';
import OrderPrintView from './OrderPrintView'; 
import { allPrintableElements, defaultPrintOrderKeys, STATUS_COLUMNS } from '../constants/printConstants';
import { printHTMLContent } from '../utils/printUtils';
import MultiPagamento from './shared/MultiPagamento';

// --- Componente de Modal de Detalhes (Simplificado) ---
const OrderDetailsModal = ({ pedido, onClose, printConfig, orderArray }) => {
    if (!pedido) return null;

    // Funções de placeholder para a impressão. 
    // Você pode integrar com a sua função printHTMLContent aqui.
    const imprimirCozinha = () => {
        console.log("Imprimindo comanda da cozinha para o pedido:", pedido.id);
        // Exemplo: printHTMLContent(gerarHtmlCozinha(pedido));
        alert("Ação de Imprimir Comanda da Cozinha disparada!");
    };

    const imprimirEntrega = () => {
        console.log("Imprimindo comanda de entrega para o pedido:", pedido.id);
        // Exemplo: printHTMLContent(gerarHtmlEntrega(pedido));
        alert("Ação de Imprimir Comanda de Entrega disparada!");
    };

    return (
        <div style={modalStyles.overlay}>
            <div style={modalStyles.content}>
                
                {/* CABEÇALHO DO MODAL */}
                <div style={modalStyles.header}>
                    <h2 style={{ margin: 0, fontSize: '20px', color: '#333' }}>
                        Detalhes do Pedido #{pedido.id}
                    </h2>
                    <button onClick={onClose} style={modalStyles.closeIcon}>✖</button>
                </div>

                {/* CORPO DO MODAL (Onde a comanda aparece) */}
                <div style={modalStyles.body}>
                    <OrderPrintView pedido={pedido} config={printConfig} orderArray={orderArray} />
                </div>

                {/* RODAPÉ DO MODAL (Botões de Impressão) */}
                <div style={modalStyles.footer}>
                    <button 
                        className="btn-primary" 
                        style={modalStyles.btnAction} 
                        onClick={imprimirCozinha}
                    >
                        🖨️ Comanda da Cozinha
                    </button>
                    
                    <button 
                        className="btn-success" 
                        style={modalStyles.btnAction} 
                        onClick={imprimirEntrega}
                    >
                        🛵 Comanda de Entrega
                    </button>
                </div>

            </div>
        </div>
    );
};


// --- Componente principal MonitorCozinha ---
const MonitorCozinha = () => {
    const [pedidos, setPedidos] = useState({ 
        'Pendente': [], 
        'Preparando': [], 
        'Pronto para Entrega/Retirada': []
    });
    const [loading, setLoading] = useState(true);
    const [mensagem, setMensagem] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null); 
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Estados para o modal de pagamento
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [orderToFinalize, setOrderToFinalize] = useState(null);
    const [modosPagamento, setModosPagamento] = useState([]);
    const [pagamentos, setPagamentos] = useState([]);
    const [entregadoresAtivos, setEntregadoresAtivos] = useState([]);
    const [selectedEntregadorId, setSelectedEntregadorId] = useState('');

    const [printConfig, setPrintConfig] = useState({});
    const [orderArray, setOrderArray] = useState(defaultPrintOrderKeys);
    const [loadingConfig, setLoadingConfig] = useState(true);


    const fetchConfig = async () => {
        setLoadingConfig(true);
        try {
            const response = await apiService.getConfiguracoes();
            const configData = response.data.data || {};

            console.log("✅ Config recebida do backend:", configData);
            console.log("✅ print_order bruto:", configData.print_order);
            console.log("✅ print_order tipo:", typeof configData.print_order);

            // normaliza defaultPrintOrderKeys para array de strings
            const defaultKeysNormalized = defaultPrintOrderKeys.map(k => {
                if (typeof k === 'string') return k;
                if (k && typeof k === 'object' && k.key) return k.key;
                return String(k);
            });

            // determina ordem salva (pode ser array ou string)
            let savedOrderArray = [];
            const raw = configData.print_order;

            if (!raw) {
                savedOrderArray = [];
            } else if (Array.isArray(raw)) {
                savedOrderArray = raw.slice();
            } else if (typeof raw === 'string' && raw.trim().length > 0) {
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) {
                        savedOrderArray = parsed;
                    } else if (typeof parsed === 'string') {
                        savedOrderArray = parsed.split(',').map(s => s.trim()).filter(Boolean);
                    }
                } catch (e) {
                    // Não é JSON, trata como CSV direto
                    savedOrderArray = raw.split(',').map(s => s.trim()).filter(Boolean);
                }
            }

            // valida a ordem contra as chaves padrão
            const validOrder = savedOrderArray.filter(k => defaultKeysNormalized.includes(k));
            const finalOrder = validOrder.length > 0
                ? validOrder.concat(defaultKeysNormalized.filter(k => !validOrder.includes(k)))
                : defaultKeysNormalized;

            console.log("✅ Ordem final calculada:", finalOrder);

            // atualiza estados
            setPrintConfig({ ...configData, print_order: finalOrder });
            setOrderArray(finalOrder);

        } catch (error) {
            console.error("Erro ao buscar configuração de impressão:", error);
            // Fallback: usa ordem padrão
            setPrintConfig({});
            setOrderArray(defaultPrintOrderKeys);
        } finally {
            setLoadingConfig(false);
        }
    };

    // 1. Carregar Pedidos
    const fetchPedidos = async () => {
        setLoading(true);
        try {
            const response = await apiService.listarPedidos(); 
            const orders = response.data.data;

            const newPedidos = { 
                'Pendente': [], 
                'Preparando': [], 
                'Pronto para Entrega/Retirada': []
            };

            orders.forEach(pedido => {
                if (newPedidos.hasOwnProperty(pedido.status)) { 
                    newPedidos[pedido.status].push(pedido);
                }
            });
            
            setPedidos(newPedidos);
            setMensagem('');

        } catch (error) {
            setMensagem('Erro ao carregar pedidos.');
            console.error("Erro ao carregar pedidos no front-end:", error);
        } finally {
            setLoading(false);
        }
    };

    // 2. Atualizar Status para o Próximo (Sem reverter)
    const handleUpdateStatus = async (pedidoId, currentStatus) => {
        const nextStatus = STATUS_COLUMNS[currentStatus].nextStatus;

        if (!nextStatus) {
            setMensagem('Este é o status final.');
            return;
        }

        try {
            await apiService.atualizarStatusPedido(pedidoId, nextStatus); 
            setMensagem(`Status do Pedido #${pedidoId} alterado para ${nextStatus}.`);
            fetchPedidos(); 
        } catch (error) {
            setMensagem('Erro ao atualizar o status do pedido.');
        }
    };

    const handleCancelarPedido = async (pedidoId) => {
        if (!window.confirm(`Tem certeza que deseja CANCELAR o pedido #${pedidoId}?`)) {
            return;
        }

        try {
            await apiService.atualizarStatusPedido(pedidoId, 'Cancelado'); 
            setMensagem(`🚨 Pedido #${pedidoId} CANCELADO.`);
            fetchPedidos(); 
        } catch (error) {
            setMensagem('Erro ao cancelar o pedido.');
        }
    };
    
    const handleFinalizarPedido = async (pedido) => {
        // Pedidos de mesa: marca como 'Servido' (some do Kanban mas fica no histórico da mesa)
        if (pedido.mesa_id) {
            try {
                await apiService.atualizarStatusPedido(pedido.id, 'Servido');
                setMensagem(`Mesa: Pedido #${pedido.id} servido! Pagamento no fechamento da mesa.`);
                fetchPedidos();
            } catch (error) {
                setMensagem('Erro ao finalizar pedido da mesa.');
            }
            return;
        }

        // Delivery / Balcão: abre modal de finalização.
        // Se já foi pago (total_pagamentos > 0), a interface vai ocultar a seleção financeira.
        setOrderToFinalize(pedido);
        
        let initialPaymentMode = '';
        if (pedido.modo_pagamento_id) {
            initialPaymentMode = pedido.modo_pagamento_id;
        } else if (modosPagamento.length > 0) {
            initialPaymentMode = modosPagamento[0].id;
        }

        setPagamentos([
            { metodo_pagamento_id: initialPaymentMode, valor: pedido.valor_total || 0 }
        ]);

        setIsPaymentModalOpen(true);
    };

    const confirmPaymentAndFinalize = async () => {
        const isJaPago = orderToFinalize?.total_pagamentos > 0;
        const totalPago = pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0);
        const totalPedido = Number(orderToFinalize?.valor_total || 0);

        if (!isJaPago) {
            if (totalPago < (totalPedido - 0.01)) {
                return setMensagem('O total pago é menor que o total do pedido!');
            }
            if (pagamentos.some(p => !p.metodo_pagamento_id)) {
                return setMensagem('Selecione o método de todos os pagamentos!');
            }
        }

        try {
            setLoading(true);
            await apiService.finalizarPedido({
                pedido_id: orderToFinalize.id,
                mesa_id: null, // Delivery/Balcão
                valor_total: orderToFinalize.valor_total,
                desconto: orderToFinalize.desconto || 0,
                pagamentos: isJaPago ? [] : pagamentos,
                entregador_id: selectedEntregadorId || null,
                cliente_id: orderToFinalize.cliente_id || null,
                cliente_nome: orderToFinalize.nome_cliente || orderToFinalize.cliente_nome || null
            });
            
            setMensagem(`Pedido #${orderToFinalize.id} finalizado e registrado no caixa com sucesso.`);
            setIsPaymentModalOpen(false);
            setOrderToFinalize(null);
            setSelectedEntregadorId('');
            fetchPedidos(); // Atualiza o kanban
        } catch (error) {
            setMensagem('Erro ao confirmar entrega e pagamento.');
            console.error("Erro ao finalizar pedido:", error);
        } finally {
            setLoading(false);
        }
    };

const handleRevertStatus = async (pedidoId, currentStatus) => {
    const prevStatus = STATUS_COLUMNS[currentStatus].prevStatus;

    if (!prevStatus) {
        setMensagem('Este pedido está no status inicial e não pode ser revertido.');
        return;
    }

    try {
        // Reutilizamos a função de API atualizarStatusPedido
        await apiService.atualizarStatusPedido(pedidoId, prevStatus); 
        setMensagem(`Status do Pedido #${pedidoId} revertido para ${prevStatus}.`);
        fetchPedidos(); // Atualiza a lista de pedidos
    } catch (error) {
        console.error("Erro ao reverter o status do pedido:", error);
        setMensagem('Erro ao reverter o status do pedido.');
    }
};

    // Exemplo de função viewDetails (use seu serviço API existente se aplicável)
    const viewDetails = async (pedidoId) => {
        try {
            setLoading(true);
            // Usamos o apiService que já está configurado corretamente no projeto
            const response = await apiService.buscarPedidoDetalhes(pedidoId);
        
            console.log('✅ Detalhes do pedido recebidos:', response.data);
        
            const pedido = response.data.data || response.data; // Tenta capturar o objeto
        
            if (!pedido) {
                setMensagem('Detalhes do pedido não encontrados.');
                return;
            }
        
            setSelectedOrder(pedido);
            setOrderArray(printConfig?.print_order || orderArray || []);
            setIsModalOpen(true);
        } catch (err) {
            console.error('❌ Erro ao buscar detalhe do pedido:', err);
            setMensagem('Erro ao carregar detalhes do pedido. Verifique se a rota existe no servidor.');
        } finally {
            setLoading(false);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedOrder(null);
    };

    const fetchModosPagamento = async () => {
        try {
            const response = await apiService.listarModosPagamento();
            const modos = response.data.data || [];
            setModosPagamento(modos);
        } catch (error) {
            console.error("Erro ao carregar modos de pagamento:", error);
        }
    };

    const fetchEntregadores = async () => {
        try {
            const res = await apiService.listarEntregadores();
            const todos = res.data.data || [];
            setEntregadoresAtivos(todos.filter(e => e.ativo === 1));
        } catch (error) {
            console.error("Erro ao carregar entregadores:", error);
        }
    };

    useEffect(() => {
        fetchConfig();
        fetchPedidos();
        fetchModosPagamento();
        fetchEntregadores();
        // Mantemos o polling
        const intervalId = setInterval(fetchPedidos, 30000); 
        return () => clearInterval(intervalId);
    }, []);

    if (loadingConfig) {
        return <div style={{ padding: '20px', textAlign: 'center' }}>Carregando Configurações...</div>;
    }

    return (
        <div className="monitor-cozinha-container">
            <h2>Monitor de Pedidos {loading && '(Carregando...)'}</h2>
            {mensagem && <p className="message">{mensagem}</p>}
            
            <div className="kanban-board">
                {/* Itera sobre APENAS as 3 colunas */}
                {Object.keys(STATUS_COLUMNS).map(status => (
                    <div key={status} className="kanban-column">
                        <h3>{STATUS_COLUMNS[status].label} ({pedidos[status]?.length || 0})</h3>
                        <div className="card-list">
                            {pedidos[status]?.map(pedido => (
                                <div key={pedido.id} className="pedido-card">
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                                        {STATUS_COLUMNS[status].prevStatus && (
                                            <button 
                                                className="btn-prev-status-small"
                                                onClick={() => handleRevertStatus(pedido.id, status)}
                                                title={`Voltar para ${STATUS_COLUMNS[status].prevStatus}`}
                                                style={{ fontSize: '1.2em', cursor: 'pointer', border: 'none', background: 'transparent', padding: 0, marginTop: '2px' }}
                                            >⏪
                                            </button>
                                        )}
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <h4 style={{ margin: 0, fontSize: '18px', color: '#2c3e50', lineHeight: '1.2' }}>
                                                    {pedido.tipo === 'Mesa' || pedido.mesa_numero ? '🪑 ' : 
                                                     (pedido.tipo === 'Delivery' || pedido.endereco_entrega ? '🛵 ' : '🚶 ')}
                                                    {pedido.mesa_numero ? `Mesa ${pedido.mesa_numero}` : 
                                                    (pedido.nome_cliente || pedido.cliente_nome || 'Balcão')}
                                                </h4>
                                                <span style={{ fontSize: '11px', color: '#999', marginLeft: '10px' }}>#{pedido.id}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '13px', color: '#555', marginBottom: '8px' }}>
                                        <div style={{ fontWeight: 'bold', color: '#e67e22' }}>
                                            Total: {Number(pedido.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#aaa' }}>
                                            🕒 {pedido.data_hora ? new Date(pedido.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                        </div>
                                    </div>

                                    {pedido.endereco_entrega && (
                                        <p style={{ fontSize: '12px', color: '#aaa', margin: '4px 0' }}>
                                            📍 {pedido.endereco_entrega}
                                            {/* Fallback para pedidos antigos: Só adiciona o nº se o endereço for o original do cadastro */}
                                            {pedido.cliente_numero && 
                                             pedido.endereco_entrega === pedido.cliente_endereco_original &&
                                             !pedido.endereco_entrega.includes(pedido.cliente_numero)
                                                ? `, nº ${pedido.cliente_numero}`
                                                : ''}
                                            {pedido.complemento_entrega ? ` — ${pedido.complemento_entrega}` : ''}
                                        </p>
                                    )}
                                    
                                    {pedido.observacao && (
                                        <div style={{ background: '#fff3cd', color: '#856404', padding: '6px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', margin: '6px 0', border: '1px solid #ffeeba' }}>
                                            ⚠️ Obs: {pedido.observacao}
                                        </div>
                                    )}
                                    
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                                        <button 
                                            onClick={() => viewDetails(pedido.id)}
                                            style={{ padding: '6px 10px', fontSize: '12px', background: '#444', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            📄 Detalhes
                                        </button>
                                        <button 
                                            onClick={() => handleCancelarPedido(pedido.id)}
                                            style={{ padding: '6px 10px', fontSize: '12px', background: '#ff7675', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            ✖ cancelar
                                        </button>
                                    </div>
                                    
                                    {STATUS_COLUMNS[status].nextStatus && (
                                        status === 'Pronto para Entrega/Retirada' ? (
                                        <button 
                                            className="btn-finalizar-status"
                                            onClick={() => handleFinalizarPedido(pedido)}
                                        >
                                            FINALIZAR PEDIDO
                                        </button>
                                        ) : (
                                            <button 
                                                className="btn-next-status"
                                                onClick={() => handleUpdateStatus(pedido.id, status)}
                                            >
                                                Mover para {STATUS_COLUMNS[status].nextStatus?.split('/')[0]}
                                            </button>
                                        )
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && selectedOrder && (
                <OrderDetailsModal 
                    pedido={selectedOrder} 
                    onClose={closeModal} 
                    printConfig={printConfig}
                    orderArray={orderArray}
                />
            )}

            {isPaymentModalOpen && orderToFinalize && (
                <div style={modalStyles.overlay}>
                    <div style={modalStyles.content}>
                        <div style={modalStyles.header}>
                            <h2 style={{ margin: 0, fontSize: '20px', color: '#333' }}>
                                Confirmar Entrega - Pedido #{orderToFinalize.id}
                            </h2>
                            <button onClick={() => setIsPaymentModalOpen(false)} style={modalStyles.closeIcon}>✖</button>
                        </div>
                        <div style={modalStyles.body}>
                            <p style={{ fontSize: '16px', margin: '5px 0' }}><strong>Cliente:</strong> {orderToFinalize.cliente_nome || 'N/A'}</p>
                            <p style={{ fontSize: '18px', color: '#e74c3c', margin: '5px 0' }}><strong>Valor Total:</strong> R$ {Number(orderToFinalize.valor_total || 0).toFixed(2)}</p>
                            
                            {/* Mostrar opção de entregador apenas se for Delivery (tem cliente associado e não é de mesa) */}
                            {(!orderToFinalize.mesa_id && !!orderToFinalize.cliente_nome) && (
                                <div style={{ marginTop: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>🏍️ Informar Entregador (Opcional):</label>
                                    <input 
                                        type="text" 
                                        list="entregadores-list"
                                        placeholder="Selecione ou digite o Entregador"
                                        value={selectedEntregadorId}
                                        onChange={(e) => setSelectedEntregadorId(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '16px', boxSizing: 'border-box' }}
                                    />
                                    <datalist id="entregadores-list">
                                        {entregadoresAtivos.map(ent => (
                                            <option key={ent.id} value={ent.id}>{ent.nome}</option>
                                        ))}
                                    </datalist>
                                </div>
                            )}

                                {/* MultiPagamento só é exibido se NÃO tiver sido pago previamente */}
                            {!orderToFinalize.total_pagamentos && (
                                <div style={{ marginTop: '20px' }}>
                                    <MultiPagamento 
                                        metodos={modosPagamento} 
                                        totalPedido={Number(orderToFinalize.valor_total || 0)} 
                                        tipoPedido={orderToFinalize.tipo}
                                        onChange={setPagamentos} 
                                    />
                                </div>
                            )}
                            
                            {orderToFinalize.total_pagamentos > 0 && (
                                <div style={{ marginTop: '20px', padding: '15px', background: '#d4edda', color: '#155724', borderRadius: '8px', border: '1px solid #c3e6cb', textAlign: 'center' }}>
                                    <strong style={{ fontSize: '16px' }}>✔️ PEDIDO JÁ PAGO</strong>
                                    <p style={{ margin: '5px 0 0', fontSize: '13px' }}>Nenhum pagamento adicional é necessário no fechamento.</p>
                                </div>
                            )}
                        </div>
                        <div style={modalStyles.footer}>
                            <button 
                                className="btn-success" 
                                style={{...modalStyles.btnAction, backgroundColor: '#2ecc71', color: '#fff', border: 'none'}} 
                                onClick={confirmPaymentAndFinalize}
                                disabled={loading}
                            >
                                {loading ? 'Aguarde...' : '✅ Confirmar Entrega'}
                            </button>
                            <button 
                                className="btn-secondary" 
                                style={{...modalStyles.btnAction, backgroundColor: '#95a5a6', color: '#fff', border: 'none'}} 
                                onClick={() => setIsPaymentModalOpen(false)}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const modalStyles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    content: {
        backgroundColor: '#fff',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        overflow: 'hidden'
    },
    header: {
        padding: '15px 20px',
        borderBottom: '1px solid #eee',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8f9fa'
    },
    closeIcon: {
        background: 'transparent',
        border: 'none',
        fontSize: '18px',
        cursor: 'pointer',
        color: '#999'
    },
    body: {
        padding: '20px',
        overflowY: 'auto',
        flex: 1,
        backgroundColor: '#fafafa'
    },
    footer: {
        padding: '15px 20px',
        borderTop: '1px solid #eee',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        backgroundColor: '#fff'
    },
    btnAction: {
        padding: '12px',
        fontSize: '15px',
        fontWeight: 'bold',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px'
    }
};

export default MonitorCozinha;