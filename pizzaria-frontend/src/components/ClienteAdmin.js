// src/components/ClienteAdmin.js
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { mascararCEP, mascararTelefone, mascararCelular } from '../utils/helpers';

const TIPO_COLOR = {
    'Delivery': '#e67e22',
    'Mesa': '#3498db',
    'Balcão': '#27ae60',
};

const STATUS_COLOR = {
    'Finalizado': '#27ae60',
    'Cancelado': '#e74c3c',
    'Pendente': '#f39c12',
    'Em Preparo': '#3498db',
    'Saiu para Entrega': '#9b59b6',
};

const ClienteAdmin = () => {
    const [clientes, setClientes] = useState([]);
    const [filtro, setFiltro] = useState('');
    const [limitePedidos, setLimitePedidos] = useState(10);

    const initialFormState = {
        nome: '', telefone: '', celular: '', CEP: '',
        bairro: '', endereco: '', numero: '', complemento: '', observacao: ''
    };

    const [form, setForm] = useState(initialFormState);
    const [clienteEditandoId, setClienteEditandoId] = useState(null);
    const [mensagem, setMensagem] = useState('');

    // Modal débitos (mantido)
    const [modalPedidos, setModalPedidos] = useState({ aberto: false, cliente: null, lista: [], loading: false });

    // Modal histórico de pedidos
    const [modalHistorico, setModalHistorico] = useState({ aberto: false, cliente: null, pedidos: [], loading: false });

    const [metodosPagamento, setMetodosPagamento] = useState([]);
    const [processandoBaixa, setProcessandoBaixa] = useState(false);
    const [cupomParaLiquidar, setCupomParaLiquidar] = useState(null);
    const [valorBaixa, setValorBaixa] = useState('');
    const [metodoBaixaId, setMetodoBaixaId] = useState('');

    // FIFO e Histórico
    const [modoBaixaGeral, setModoBaixaGeral] = useState(false);
    const [exibirHistorico, setExibirHistorico] = useState(false);

    useEffect(() => {
        fetchClientes();
        fetchConfig();
        fetchMetodos();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchMetodos = async () => {
        try {
            const res = await apiService.listarModosPagamento();
            // Filtra apenas métodos que NÃO são cupom para receber o dinheiro
            const lista = (res.data.data || res.data).filter(m => Number(m.is_cupom) !== 1 && m.ativo === 1);
            setMetodosPagamento(lista);
        } catch { }
    };

    const fetchConfig = async () => {
        try {
            const res = await apiService.getConfiguracoes();
            const limite = parseInt(res.data.data?.historico_pedidos_limite ?? 10);
            setLimitePedidos(limite);
        } catch { }
    };

    const fetchClientes = async () => {
        try {
            const response = await apiService.listarClientes();
            setClientes(response.data.data);
        } catch { setMensagem('Erro ao carregar clientes.'); }
    };

    const clientesFiltrados = clientes.filter(c =>
        c.nome.toLowerCase().includes(filtro.toLowerCase()) ||
        c.telefone.includes(filtro) ||
        (c.celular && c.celular.includes(filtro)) ||
        (c.bairro && c.bairro.toLowerCase().includes(filtro.toLowerCase()))
    );

    const handleAbrirListaDebitos = async (cliente) => {
        setModalPedidos({ aberto: true, cliente, lista: [], loading: true });
        setCupomParaLiquidar(null); 
        setModoBaixaGeral(false);
        setExibirHistorico(false);
        try {
            const response = await apiService.listarCupons({ cliente_id: cliente.id });
            setModalPedidos({ aberto: true, cliente, lista: response.data.data, loading: false });
        } catch {
            setModalPedidos({ aberto: true, cliente, lista: [], loading: false });
            setMensagem('Erro ao carregar débitos.');
        }
    };

    const handleConfirmarBaixa = async () => {
        if (!metodoBaixaId) return alert('Selecione a forma de pagamento.');
        const valor = parseFloat(valorBaixa);
        if (isNaN(valor) || valor <= 0) return alert('Informe um valor válido.');

        setProcessandoBaixa(true);
        try {
            await apiService.darBaixaCupom(cupomParaLiquidar.id, {
                valor_pago: valor,
                metodo_pagamento_id: metodoBaixaId
            });
            alert('Baixa realizada com sucesso!');
            setCupomParaLiquidar(null);

            // Recarrega todos os dados
            const responseClientes = await apiService.listarClientes();
            const listaNova = responseClientes.data.data;
            setClientes(listaNova);
            
            const clienteAtualizado = listaNova.find(c => c.id === modalPedidos.cliente.id);
            if (clienteAtualizado) {
                setModalPedidos(prev => ({ ...prev, cliente: clienteAtualizado }));
            }
            
            handleAbrirListaDebitos(clienteAtualizado || modalPedidos.cliente);
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao realizar baixa.');
        } finally {
            setProcessandoBaixa(false);
        }
    };

    const handleConfirmarBaixaGeral = async () => {
        if (!metodoBaixaId) return alert('Selecione a forma de pagamento.');
        const valor = parseFloat(valorBaixa);
        if (isNaN(valor) || valor <= 0) return alert('Informe um valor válido.');

        setProcessandoBaixa(true);
        try {
            const res = await apiService.baixaGeralCupons(modalPedidos.cliente.id, {
                valor_pago: valor,
                metodo_pagamento_id: metodoBaixaId
            });
            alert(res.data.message || 'Baixa geral realizada!');
            setModoBaixaGeral(false);
            
            // Recarrega todos os dados para atualizar a UI principal e o modal
            const responseClientes = await apiService.listarClientes();
            const listaNova = responseClientes.data.data;
            setClientes(listaNova);
            
            // Atualiza o cliente específico dentro do modal
            const clienteAtualizado = listaNova.find(c => c.id === modalPedidos.cliente.id);
            if (clienteAtualizado) {
                setModalPedidos(prev => ({ ...prev, cliente: clienteAtualizado }));
            }
            
            handleAbrirListaDebitos(clienteAtualizado || modalPedidos.cliente);
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao realizar baixa geral.');
        } finally {
            setProcessandoBaixa(false);
        }
    };

    // Abre modal de histórico de pedidos
    const abrirHistorico = async (cliente) => {
        setModalHistorico({ aberto: true, cliente, pedidos: [], loading: true });
        try {
            const res = await apiService.getHistoricoCliente(cliente.id, limitePedidos);
            setModalHistorico(prev => ({ ...prev, pedidos: res.data.data || [], loading: false }));
        } catch {
            setModalHistorico(prev => ({ ...prev, loading: false }));
        }
    };

    const handleCepBlur = async (e) => {
        const cep = e.target.value.replace(/\D/g, '');
        if (cep.length === 8) {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then(r => r.json());
            if (!res.erro) setForm(prev => ({ ...prev, endereco: res.logradouro, bairro: res.bairro }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (clienteEditandoId) {
                await apiService.atualizarCliente(clienteEditandoId, form);
                setMensagem('✅ Cliente atualizado com sucesso!');
            } else {
                await apiService.criarCliente(form);
                setMensagem('✅ Cliente cadastrado com sucesso!');
            }
            setForm(initialFormState);
            setClienteEditandoId(null);
            fetchClientes();
        } catch { setMensagem('❌ Erro ao salvar cliente.'); }
    };

    const formatarData = (dt) => {
        if (!dt) return '-';
        const d = new Date(dt);
        return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <style>{`
                .grid-form { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #ddd; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                .col-span-2 { grid-column: span 2; }
                .col-span-4 { grid-column: span 4; }
                .form-group { display: flex; flex-direction: column; }
                .form-group label { font-size: 12px; font-weight: bold; margin-bottom: 4px; color: #444; }
                .form-group input, .form-group textarea { padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
                .search-bar { background: #e9ecef; padding: 15px; border-radius: 8px; margin-bottom: 15px; display: flex; align-items: center; gap: 10px; }
                .btn-save { background: #28a745; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer; font-weight: bold; grid-column: span 3; }
                .btn-cancel { background: #6c757d; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer; grid-column: span 1; }
                .modal-overlay { position: fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); display:flex; justify-content:center; align-items:center; z-index:1000; padding: 16px; box-sizing: border-box; }
                .modal-content { background:white; padding:20px; border-radius:8px; width:450px; }

                /* Modal histórico */
                .historico-modal { background: #1a1a2e; border-radius: 12px; width: 100%; max-width: 680px; max-height: 88vh; display: flex; flex-direction: column; box-shadow: 0 24px 60px rgba(0,0,0,0.5); overflow: hidden; }
                .historico-header { padding: 20px 24px 16px; border-bottom: 1px solid #2d2d4e; flex-shrink: 0; }
                .historico-header h3 { margin: 0 0 4px; color: #fff; font-size: 18px; }
                .historico-header p { margin: 0; color: #8888aa; font-size: 13px; }
                .historico-lista { overflow-y: auto; padding: 16px 24px; flex: 1; }
                .historico-lista::-webkit-scrollbar { width: 6px; }
                .historico-lista::-webkit-scrollbar-track { background: #1a1a2e; }
                .historico-lista::-webkit-scrollbar-thumb { background: #3d3d6b; border-radius: 3px; }
                .pedido-card { background: #16213e; border: 1px solid #2d2d4e; border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; }
                .pedido-card-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
                .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; }
                .pedido-itens { list-style: none; padding: 0; margin: 0 0 10px; }
                .pedido-itens li { display: flex; justify-content: space-between; color: #ccd; font-size: 13px; padding: 3px 0; border-bottom: 1px solid #2a2a4a; }
                .pedido-itens li:last-child { border-bottom: none; }
                .pedido-total-row { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #3d3d6b; }
                .historico-footer { padding: 14px 24px; border-top: 1px solid #2d2d4e; flex-shrink: 0; }
                .historico-footer button { width: 100%; padding: 11px; background: #e67e22; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: bold; cursor: pointer; }
                .historico-footer button:hover { background: #d35400; }
                .empty-state { text-align: center; padding: 40px 20px; color: #666; }
                .empty-state span { font-size: 48px; display: block; margin-bottom: 12px; }
            `}</style>

            <form onSubmit={handleSubmit} className="grid-form">
                <h3 style={{ margin: '0 0 10px 0', gridColumn: 'span 4', color: 'rgb(4, 4, 14)' }}>
                    {clienteEditandoId ? '📝 Editando Cliente' : '👤 Cadastro de Cliente'}
                </h3>

                <div className="form-group col-span-2">
                    <label>Nome Completo*</label>
                    <input type="text" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
                </div>
                <div className="form-group">
                    <label>Telefone*</label>
                    <input type="text" value={form.telefone} onChange={e => setForm({ ...form, telefone: mascararTelefone(e.target.value) })} required />
                </div>
                <div className="form-group">
                    <label>Celular (Opcional)</label>
                    <input type="text" value={form.celular} onChange={e => setForm({ ...form, celular: mascararCelular(e.target.value) })} />
                </div>

                <div className="form-group">
                    <label>CEP</label>
                    <input type="text" value={form.CEP} onBlur={handleCepBlur} onChange={e => setForm({ ...form, CEP: mascararCEP(e.target.value) })} />
                </div>
                <div className="form-group">
                    <label>Bairro</label>
                    <input type="text" value={form.bairro} onChange={e => setForm({ ...form, bairro: e.target.value })} />
                </div>
                <div className="form-group">
                    <label>Endereço</label>
                    <input type="text" value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} />
                </div>
                <div className="form-group">
                    <label>Número</label>
                    <input type="text" value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} />
                </div>

                <div className="form-group col-span-4">
                    <label>Complemento / Referência</label>
                    <input type="text" value={form.complemento} placeholder="Ex: Próximo ao mercado, Apartamento 22..." onChange={e => setForm({ ...form, complemento: e.target.value })} />
                </div>

                <div className="form-group col-span-4">
                    <label>Observação Interna</label>
                    <textarea rows="2" value={form.observacao} placeholder="Notas sobre o cliente..." onChange={e => setForm({ ...form, observacao: e.target.value })} />
                </div>

                <button type="submit" className="btn-save">
                    {clienteEditandoId ? 'ATUALIZAR DADOS' : 'SALVAR NOVO CLIENTE'}
                </button>
                {clienteEditandoId && (
                    <button type="button" className="btn-cancel" onClick={() => { setForm(initialFormState); setClienteEditandoId(null); }}>
                        CANCELAR
                    </button>
                )}
            </form>

            {mensagem && <div style={{ marginBottom: '16px', padding: '10px 16px', background: mensagem.startsWith('✅') ? '#d4edda' : '#f8d7da', borderRadius: '6px', color: mensagem.startsWith('✅') ? '#155724' : '#721c24' }}>{mensagem}</div>}

            <div className="search-bar">
                <strong>Filtrar:</strong>
                <input
                    type="text"
                    placeholder="Busque por nome, telefone ou bairro..."
                    style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                />
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                <thead>
                    <tr style={{ background: '#343a40', color: '#fff', textAlign: 'left' }}>
                        <th style={{ padding: '12px' }}>Nome</th>
                        <th>Contato</th>
                        <th>Endereço</th>
                        <th>Financeiro</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {clientesFiltrados.map(cliente => (
                        <tr key={cliente.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '12px' }}>
                                <strong>{cliente.nome}</strong><br />
                                <small style={{ color: '#666' }}>{cliente.observacao}</small>
                            </td>
                            <td>{cliente.telefone} <br /> <small>{cliente.celular}</small></td>
                            <td>
                                {cliente.endereco}, {cliente.numero} {cliente.bairro && `- ${cliente.bairro}`}<br />
                                <small style={{ color: '#888' }}>{cliente.complemento}</small>
                            </td>
                            <td>
                                {cliente.valor_pendente > 0 ? (
                                    <div>
                                        <div style={{ background: '#dc3545', color: 'white', borderRadius: '6px', padding: '4px 10px', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px', display: 'inline-block' }}>
                                            🔴 Valores em Aberto
                                        </div>
                                        <div>
                                            <button onClick={() => handleAbrirListaDebitos(cliente)} style={{ background: 'transparent', border: '1px solid #dc3545', color: '#dc3545', borderRadius: '4px', cursor: 'pointer', padding: '3px 8px', fontSize: '12px' }}>
                                                R$ {parseFloat(cliente.valor_pendente).toFixed(2)} — Ver detalhes
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <span style={{ color: '#28a745', fontWeight: 'bold', fontSize: '13px' }}>✅ Em dia</span>
                                )}
                            </td>
                            <td style={{ display: 'flex', gap: '6px', padding: '12px', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => { setClienteEditandoId(cliente.id); setForm(cliente); window.scrollTo(0, 0); }}
                                    style={{ background: '#007bff', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                                >
                                    ✏️ Editar
                                </button>
                                <button
                                    onClick={() => abrirHistorico(cliente)}
                                    style={{ background: '#6f42c1', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                                    title="Ver histórico de pedidos"
                                >
                                    🕓 Histórico
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Modal: Débitos Pendentes */}
            {modalPedidos.aberto && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>Débitos de {modalPedidos.cliente?.nome}</h3>
                            <button 
                                onClick={() => setExibirHistorico(!exibirHistorico)}
                                style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
                            >
                                {exibirHistorico ? 'Ver Abertos' : 'Ver Histórico'}
                            </button>
                        </div>
                        <hr />

                        {!exibirHistorico && (
                            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <small style={{ color: '#888' }}>SALDO DEVEDOR TOTAL</small>
                                    <h2 style={{ margin: 0, color: '#dc3545' }}>R$ {parseFloat(modalPedidos.cliente?.valor_pendente || 0).toFixed(2)}</h2>
                                </div>
                                {!modoBaixaGeral && modalPedidos.cliente?.valor_pendente > 0 && (
                                    <button 
                                        onClick={() => {
                                            setModoBaixaGeral(true);
                                            setValorBaixa(parseFloat(modalPedidos.cliente?.valor_pendente).toFixed(2));
                                            setMetodoBaixaId(metodosPagamento[0]?.id || '');
                                        }}
                                        style={{ padding: '8px 15px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                        💰 QUITAR / ABATER
                                    </button>
                                )}
                            </div>
                        )}

                        {modoBaixaGeral && !exibirHistorico && (
                            <div style={{ background: '#fff3cd', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #ffeeba' }}>
                                <h4 style={{ margin: '0 0 10px 0' }}>💵 Recebimento Global (FIFO)</h4>
                                <div style={{ marginBottom: '10px' }}>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold' }}>Valor Recebido (R$):</label>
                                    <input 
                                        type="number" 
                                        value={valorBaixa} 
                                        onChange={e => setValorBaixa(e.target.value)}
                                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                                    />
                                </div>
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold' }}>Forma de Pagamento:</label>
                                    <select 
                                        value={metodoBaixaId}
                                        onChange={e => setMetodoBaixaId(e.target.value)}
                                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                                    >
                                        <option value="">Selecione...</option>
                                        {metodosPagamento.map(m => (
                                            <option key={m.id} value={m.id}>{m.nome}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={handleConfirmarBaixaGeral} disabled={processandoBaixa} style={{ flex: 1, padding: '10px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                                        {processandoBaixa ? '...' : 'CONFIRMAR RECEBIMENTO'}
                                    </button>
                                    <button onClick={() => setModoBaixaGeral(false)} style={{ flex: 1, padding: '10px', background: '#888', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                                        CANCELAR
                                    </button>
                                </div>
                                <p style={{ fontSize: '10px', color: '#856404', marginTop: '8px', textAlign: 'center' }}>
                                    * O valor será abatido dos débitos mais antigos primeiro.
                                </p>
                            </div>
                        )}

                        <div style={{ margin: '15px 0', maxHeight: '350px', overflowY: 'auto' }}>
                            {modalPedidos.loading ? (
                                <p>Carregando...</p>
                            ) : (
                                <>
                                    {!exibirHistorico && (
                                        modalPedidos.lista.filter(c => c.status === 'Pendente').length === 0 ? (
                                            <p style={{ color: '#888', textAlign: 'center' }}>Nenhum débito pendente.</p>
                                        ) : (
                                            modalPedidos.lista.filter(c => c.status === 'Pendente').map(c => (
                                                <div key={c.id} style={{ padding: '12px', borderBottom: '1px solid #eee', fontSize: '14px', background: '#fff' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                        <span style={{ fontWeight: 'bold', color: '#dc3545' }}>
                                                            🔴 Pendente
                                                        </span>
                                                        <span style={{ color: '#666', fontSize: '12px' }}>{new Date(c.data_criacao).toLocaleDateString()}</span>
                                                    </div>
                                                    <div style={{ color: '#444', fontSize: '13px' }}>{c.descricao || `Pedido #${c.pedido_id}`}</div>
                                                    <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '16px', color: '#333', marginTop: '5px' }}>
                                                        R$ {parseFloat(c.valor).toFixed(2)}
                                                    </div>
                                                    
                                                    {!modoBaixaGeral && (
                                                        <button 
                                                            onClick={() => {
                                                                setCupomParaLiquidar(c);
                                                                setValorBaixa(parseFloat(c.valor).toFixed(2));
                                                                setMetodoBaixaId(metodosPagamento[0]?.id || '');
                                                            }}
                                                            style={{ marginTop: '8px', padding: '5px 10px', background: 'transparent', color: '#27ae60', border: '1px solid #27ae60', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                                                        >
                                                            💲 Baixa Individual
                                                        </button>
                                                    )}

                                                    {cupomParaLiquidar && cupomParaLiquidar.id === c.id && (
                                                        <div style={{ marginTop: '10px', padding: '10px', background: '#f1f1f1', borderRadius: '6px' }}>
                                                            <div style={{ marginBottom: '8px' }}>
                                                                <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Valor Recebido (R$):</label>
                                                                <input type="number" value={valorBaixa} onChange={e => setValorBaixa(e.target.value)} style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }} />
                                                            </div>
                                                            <div style={{ marginBottom: '8px' }}>
                                                                <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Forma de Pagamento:</label>
                                                                <select value={metodoBaixaId} onChange={e => setMetodoBaixaId(e.target.value)} style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}>
                                                                    <option value="">Selecione...</option>
                                                                    {metodosPagamento.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                                                                </select>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                                <button onClick={handleConfirmarBaixa} disabled={processandoBaixa} style={{ flex: 1, padding: '7px', background: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>{processandoBaixa ? '...' : 'CONFIRMAR'}</button>
                                                                <button onClick={() => setCupomParaLiquidar(null)} style={{ flex: 1, padding: '7px', background: '#888', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>CANCELAR</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )
                                    )}

                                    {exibirHistorico && (
                                        modalPedidos.lista.filter(c => c.status !== 'Pendente').length === 0 ? (
                                            <p style={{ color: '#888', textAlign: 'center' }}>Nenhum pagamento registrado.</p>
                                        ) : (
                                            modalPedidos.lista.filter(c => c.status !== 'Pendente').map(c => (
                                                <div key={c.id} style={{ padding: '12px', borderBottom: '1px solid #eee', fontSize: '14px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: c.status === 'Pago' ? '#28a745' : '#007bff', fontWeight: 'bold' }}>
                                                            {c.status === 'Pago' ? '✅ Pago Total' : '🔵 Pago Parcial'}
                                                        </span>
                                                        <span style={{ color: '#666', fontSize: '12px' }}>{c.data_baixa ? new Date(c.data_baixa).toLocaleDateString() : '—'}</span>
                                                    </div>
                                                    <div style={{ fontSize: '13px', color: '#666', marginTop: '3px' }}>
                                                        {c.descricao || `Pedido #${c.pedido_id}`} via <strong>{c.metodo_baixa_nome || '—'}</strong>
                                                    </div>
                                                    <div style={{ textAlign: 'right', fontWeight: 'bold', color: c.status === 'Pago' ? '#28a745' : '#007bff' }}>
                                                        R$ {parseFloat(c.valor).toFixed(2)}
                                                    </div>
                                                </div>
                                            ))
                                        )
                                    )}
                                </>
                            )}
                        </div>

                        <button 
                            onClick={() => { setModalPedidos({ ...modalPedidos, aberto: false }); setCupomParaLiquidar(null); setModoBaixaGeral(false); }} 
                            style={{ width: '100%', padding: '12px', background: '#333', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
                        >
                            FECHAR
                        </button>
                    </div>
                </div>
            )}

            {/* Modal: Histórico de Pedidos */}
            {modalHistorico.aberto && (
                <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalHistorico(prev => ({ ...prev, aberto: false })); }}>
                    <div className="historico-modal">
                        <div className="historico-header">
                            <h3>🕓 Histórico de Pedidos</h3>
                            <p>
                                {modalHistorico.cliente?.nome}
                                {limitePedidos > 0
                                    ? ` — Exibindo até ${limitePedidos} pedido(s)`
                                    : ' — Exibindo todos os pedidos'}
                            </p>
                        </div>

                        <div className="historico-lista">
                            {modalHistorico.loading ? (
                                <div className="empty-state">
                                    <span>⏳</span>
                                    <p style={{ color: '#888' }}>Carregando histórico...</p>
                                </div>
                            ) : modalHistorico.pedidos.length === 0 ? (
                                <div className="empty-state">
                                    <span>📭</span>
                                    <p style={{ color: '#888' }}>Nenhum pedido encontrado para este cliente.</p>
                                </div>
                            ) : (
                                modalHistorico.pedidos.map(pedido => (
                                    <div key={pedido.id} className="pedido-card">
                                        <div className="pedido-card-header">
                                            <span style={{ color: '#aab', fontSize: '13px' }}>#{pedido.id}</span>
                                            <span
                                                className="badge"
                                                style={{
                                                    background: `${TIPO_COLOR[pedido.tipo] || '#555'}22`,
                                                    color: TIPO_COLOR[pedido.tipo] || '#aaa',
                                                    border: `1px solid ${TIPO_COLOR[pedido.tipo] || '#555'}66`
                                                }}
                                            >
                                                {pedido.tipo === 'Delivery' ? '🛵' : pedido.tipo === 'Mesa' ? '🪑' : '🏠'} {pedido.tipo}
                                            </span>
                                            <span
                                                className="badge"
                                                style={{
                                                    background: `${STATUS_COLOR[pedido.status] || '#555'}22`,
                                                    color: STATUS_COLOR[pedido.status] || '#aaa',
                                                    border: `1px solid ${STATUS_COLOR[pedido.status] || '#555'}55`
                                                }}
                                            >
                                                {pedido.status}
                                            </span>
                                            {pedido.cupom_status && (
                                                <span
                                                    className="badge"
                                                    style={{
                                                        background: pedido.cupom_status === 'Pendente' ? '#e74c3c22' : '#f39c1222',
                                                        color: pedido.cupom_status === 'Pendente' ? '#e74c3c' : '#f39c12',
                                                        border: `1px solid ${pedido.cupom_status === 'Pendente' ? '#e74c3c' : '#f39c12'}55`
                                                    }}
                                                >
                                                    📌 {pedido.cupom_status === 'Pendente' ? 'Pendura' : 'Pendura Parcial'}
                                                </span>
                                            )}
                                            <span style={{ color: '#666', fontSize: '12px', marginLeft: 'auto' }}>
                                                {formatarData(pedido.data_hora)}
                                            </span>
                                        </div>

                                        {pedido.itens && pedido.itens.length > 0 && (
                                            <ul className="pedido-itens">
                                                {pedido.itens.map((item, idx) => (
                                                    <li key={idx}>
                                                        <span>{item.quantidade}x {item.nome}</span>
                                                        <span style={{ color: '#e67e22' }}>R$ {(item.valor || 0).toFixed(2)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}

                                        <div className="pedido-total-row">
                                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                                {pedido.modo_pagamento && (
                                                    <span style={{ color: '#8888aa', fontSize: '12px' }}>
                                                        💳 {pedido.modo_pagamento}
                                                    </span>
                                                )}
                                                {pedido.entregador_nome && (
                                                    <span style={{ color: '#8888aa', fontSize: '12px' }}>
                                                        🛵 {pedido.entregador_nome}
                                                    </span>
                                                )}
                                                {pedido.observacao && (
                                                    <span style={{ color: '#8888aa', fontSize: '12px' }}>
                                                        📝 {pedido.observacao}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                {pedido.desconto > 0 && (
                                                    <div style={{ fontSize: '11px', color: '#27ae60' }}>
                                                        Desconto: -R$ {pedido.desconto.toFixed(2)}
                                                    </div>
                                                )}
                                                <strong style={{ color: '#fff', fontSize: '15px' }}>
                                                    R$ {(pedido.valor_total || 0).toFixed(2)}
                                                </strong>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="historico-footer">
                            <button onClick={() => setModalHistorico(prev => ({ ...prev, aberto: false }))}>
                                FECHAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClienteAdmin;