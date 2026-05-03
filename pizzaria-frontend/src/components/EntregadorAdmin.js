import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

const EntregadorAdmin = () => {
    const [entregadores, setEntregadores] = useState([]);
    const [nome, setNome] = useState('');
    const [contato, setContato] = useState('');
    const [mensagem, setMensagem] = useState('');

    // Estados para edição in-line
    const [editingId, setEditingId] = useState(null);
    const [editNome, setEditNome] = useState('');
    const [editContato, setEditContato] = useState('');
    
    // Estados para o Modal de Histórico
    const [showHistorico, setShowHistorico] = useState(false);
    const [selectedEntregador, setSelectedEntregador] = useState(null);
    const [historico, setHistorico] = useState([]);
    const [valorPagamento, setValorPagamento] = useState('');

    // Estados para Ajuste Manual
    const [showAjuste, setShowAjuste] = useState(false);
    const [valorAjuste, setValorAjuste] = useState('');
    const [descAjuste, setDescAjuste] = useState('');

    const fetchEntregadores = async () => {
        try {
            const res = await apiService.listarEntregadores();
            setEntregadores(res.data.data || []);
        } catch (error) {
            console.error("Erro ao buscar entregadores:", error);
            setMensagem("Erro ao carregar entregadores.");
        }
    };

    useEffect(() => {
        fetchEntregadores();
    }, []);

    const handleAddEntregador = async (e) => {
        e.preventDefault();
        try {
            await apiService.criarEntregador({ nome, contato });
            setMensagem(`Entregador ${nome} salvo com sucesso!`);
            setNome('');
            setContato('');
            fetchEntregadores();
            setTimeout(() => setMensagem(''), 3000);
        } catch (error) {
            console.error("Erro ao adicionar:", error);
            setMensagem("Erro ao adicionar entregador.");
        }
    };

    const handleToggleAtivo = async (id, currentStatus) => {
        try {
            await apiService.atualizarEntregador(id, { ativo: currentStatus ? 0 : 1 });
            fetchEntregadores();
        } catch (error) {
            setMensagem("Erro ao alterar status.");
        }
    };

    const handleResetEntregas = async (id) => {
        if (!window.confirm("Zerar as entregas deste motoboy hoje?")) return;
        try {
            await apiService.atualizarEntregador(id, { quantidade_entregas_dia: 0 });
            setMensagem("Entregas zeradas com sucesso.");
            fetchEntregadores();
            setTimeout(() => setMensagem(''), 3000);
        } catch (error) {
            setMensagem("Erro ao zerar entregas.");
        }
    };

    const handleIncrementEntregas = async (id, atual) => {
        try {
            await apiService.atualizarEntregador(id, { quantidade_entregas_dia: atual + 1 });
            fetchEntregadores();
        } catch (error) {
            setMensagem("Erro ao adicionar entrega.");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Tem certeza que deseja excluir?")) return;
        try {
            await apiService.deletarEntregador(id);
            setMensagem("Entregador removido!");
            fetchEntregadores();
            setTimeout(() => setMensagem(''), 3000);
        } catch (error) {
            setMensagem("Erro ao excluir entregador.");
        }
    };

    const handleEditClick = (e) => {
        setEditingId(e.id);
        setEditNome(e.nome);
        setEditContato(e.contato || '');
    };

    const handleSaveEdit = async (id) => {
        try {
            await apiService.atualizarEntregador(id, { nome: editNome, contato: editContato });
            setMensagem("Dados atualizados com sucesso!");
            setEditingId(null);
            fetchEntregadores();
            setTimeout(() => setMensagem(''), 3000);
        } catch (error) {
            setMensagem("Erro ao atualizar entregador.");
        }
    };

    const handleOpenHistorico = async (entregador) => {
        setSelectedEntregador(entregador);
        setShowHistorico(true);
        setHistorico([]);
        try {
            const res = await apiService.getHistoricoEntregador(entregador.id);
            setHistorico(res.data.data || []);
            setValorPagamento(entregador.saldo.toString());
        } catch (error) {
            console.error("Erro ao buscar histórico:", error);
        }
    };

    const handleProcessPayment = async () => {
        if (!valorPagamento || parseFloat(valorPagamento) <= 0) return alert("Informe um valor válido.");
        if (parseFloat(valorPagamento) > selectedEntregador.saldo) {
            if (!window.confirm("O valor informado é maior que o saldo atual. Continuar?")) return;
        }

        try {
            await apiService.realizarPagamentoEntregador(selectedEntregador.id, { valor: parseFloat(valorPagamento) });
            setMensagem("Pagamento registrado com sucesso!");
            setShowHistorico(false);
            fetchEntregadores();
            setTimeout(() => setMensagem(''), 3000);
        } catch (error) {
            alert(error.response?.data?.error || "Erro ao processar pagamento.");
        }
    };

    const handleOpenAjuste = (entregador) => {
        setSelectedEntregador(entregador);
        setValorAjuste('');
        setDescAjuste('');
        setShowAjuste(true);
    };

    const handleProcessAjuste = async () => {
        if (!valorAjuste || isNaN(parseFloat(valorAjuste))) return alert("Informe um valor válido (ex: 5.00 ou -10.00).");
        if (!descAjuste) return alert("A descrição é obrigatória para registrar no histórico.");

        try {
            await apiService.realizarAjusteEntregador(selectedEntregador.id, { valor: parseFloat(valorAjuste), descricao: descAjuste });
            setMensagem("Ajuste manual registrado com sucesso!");
            setShowAjuste(false);
            fetchEntregadores();
            setTimeout(() => setMensagem(''), 3000);
        } catch (error) {
            alert(error.response?.data?.error || "Erro ao realizar o ajuste.");
        }
    };

    return (
        <div className="admin-container" style={{ padding: '20px' }}>
            <h2>🛵 Cadastro de Entregadores</h2>
            {mensagem && <div className="alert">{mensagem}</div>}

            <form onSubmit={handleAddEntregador} style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '20px', alignItems: 'center' }}>
                <input 
                    type="text" 
                    placeholder="Nome do Entregador" 
                    value={nome} 
                    onChange={(e) => setNome(e.target.value)} 
                    required 
                    style={{ flex: '2', minWidth: '250px', padding: '12px', fontSize: '16px', borderRadius: '5px', border: '1px solid #ccc' }}
                />
                <input 
                    type="text" 
                    placeholder="Contato (ex: 11999999999)" 
                    value={contato} 
                    onChange={(e) => setContato(e.target.value)} 
                    style={{ flex: '1', minWidth: '200px', padding: '12px', fontSize: '16px', borderRadius: '5px', border: '1px solid #ccc' }}
                />
                <button type="submit" className="btn-success" style={{ padding: '12px 25px', fontSize: '16px', borderRadius: '5px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    ✚ Adicionar
                </button>
            </form>

            <div className="table-responsive">
                <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f4f4f4', textAlign: 'left' }}>
                            <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Status</th>
                            <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Nome</th>
                            <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Contato</th>
                            <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Saldo</th>
                            <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Entregas (Hoje)</th>
                            <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entregadores.length === 0 ? (
                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>Nenhum entregador cadastrado.</td></tr>
                        ) : (
                            entregadores.map(e => (
                                <tr key={e.id} style={{ opacity: e.ativo ? 1 : 0.6, borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '10px' }}>
                                        <button 
                                            onClick={() => handleToggleAtivo(e.id, e.ativo)}
                                            style={{ 
                                                padding: '5px 10px', 
                                                borderRadius: '20px', 
                                                border: 'none', 
                                                color: '#fff', 
                                                cursor: 'pointer',
                                                background: e.ativo ? '#2ecc71' : '#e74c3c' 
                                            }}
                                        >
                                            {e.ativo ? 'Em Serviço' : 'Inativo'}
                                        </button>
                                    </td>
                                    <td style={{ padding: '10px', fontWeight: 'bold' }}>
                                        {editingId === e.id ? (
                                            <input type="text" value={editNome} onChange={ev => setEditNome(ev.target.value)} style={{ padding: '8px', width: '100%', borderRadius: '4px', border: '1px solid #3498db' }} />
                                        ) : (
                                            e.nome
                                        )}
                                    </td>
                                    <td style={{ padding: '10px' }}>
                                        {editingId === e.id ? (
                                            <input type="text" value={editContato} onChange={ev => setEditContato(ev.target.value)} style={{ padding: '8px', width: '100%', borderRadius: '4px', border: '1px solid #3498db' }} />
                                        ) : (
                                            e.contato || '-'
                                        )}
                                    </td>
                                    <td style={{ padding: '10px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ color: e.saldo > 0 ? '#e67e22' : '#27ae60', fontWeight: 'bold', fontSize: '16px' }}>
                                                R$ {Number(e.saldo || 0).toFixed(2)}
                                            </span>
                                            <button 
                                                onClick={() => handleOpenHistorico(e)}
                                                style={{ background: 'none', border: 'none', color: '#3498db', fontSize: '11px', cursor: 'pointer', textAlign: 'left', padding: 0, textDecoration: 'underline' }}
                                            >
                                                Ver Histórico / Pagar
                                            </button>
                                            <button 
                                                onClick={() => handleOpenAjuste(e)}
                                                style={{ background: 'none', border: 'none', color: '#8e44ad', fontSize: '11px', cursor: 'pointer', textAlign: 'left', padding: '5px 0 0', textDecoration: 'underline' }}
                                            >
                                                Ajuste (+/-)
                                            </button>
                                        </div>
                                    </td>
                                    <td style={{ padding: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{e.quantidade_entregas_dia}</span>
                                            <button 
                                                onClick={() => handleIncrementEntregas(e.id, e.quantidade_entregas_dia)}
                                                style={{ padding: '2px 8px', cursor: 'pointer', fontWeight: 'bold', border: '1px solid #ccc', borderRadius: '4px' }}
                                                title="Soma +1 Entrega"
                                            >
                                                +1
                                            </button>
                                            <button 
                                                onClick={() => handleResetEntregas(e.id)}
                                                style={{ padding: '2px 8px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px', background: '#f8d7da', color: '#721c24' }}
                                                title="Zerar para Hoje"
                                            >
                                                Zerar
                                            </button>
                                        </div>
                                    </td>
                                    <td style={{ padding: '10px', display: 'flex', gap: '5px' }}>
                                        {editingId === e.id ? (
                                            <>
                                                <button onClick={() => handleSaveEdit(e.id)} style={{ padding: '5px 10px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Salvar</button>
                                                <button onClick={() => setEditingId(null)} style={{ padding: '5px 10px', background: '#ccc', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
                                            </>
                                        ) : (
                                            <button onClick={() => handleEditClick(e)} style={{ padding: '5px 10px', background: 'transparent', color: '#3498db', border: '1px solid #3498db', borderRadius: '4px', cursor: 'pointer' }}>Editar</button>
                                        )}
                                        <button 
                                            onClick={() => handleDelete(e.id)} 
                                            style={{ padding: '5px 10px', background: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            Excluir
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL DE HISTÓRICO E PAGAMENTO */}
            {showHistorico && selectedEntregador && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', width: '90%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>Histórico de Saldo: {selectedEntregador.nome}</h3>
                            <button onClick={() => setShowHistorico(false)} style={{ background: '#eee', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer' }}>&times;</button>
                        </div>

                        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <span style={{ fontSize: '14px', color: '#666' }}>Saldo Pendente</span>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e67e22' }}>R$ {Number(selectedEntregador.saldo).toFixed(2)}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold' }}>Valor do Pagamento</label>
                                    <input 
                                        type="number" 
                                        value={valorPagamento} 
                                        onChange={ev => setValorPagamento(ev.target.value)} 
                                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '120px' }} 
                                    />
                                </div>
                                <button 
                                    onClick={handleProcessPayment}
                                    style={{ background: '#27ae60', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    DAR BAIXA (PAGAR)
                                </button>
                            </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                                    <th style={{ padding: '10px' }}>Data</th>
                                    <th>Tipo</th>
                                    <th>Descrição</th>
                                    <th style={{ textAlign: 'right' }}>Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historico.length === 0 ? (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Nenhuma movimentação encontrada.</td></tr>
                                ) : (
                                    historico.map((h, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '10px', fontSize: '13px' }}>{new Date(h.data).toLocaleDateString('pt-BR')} {new Date(h.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                                            <td>
                                                <span style={{ 
                                                    padding: '2px 6px', 
                                                    borderRadius: '4px', 
                                                    fontSize: '10px', 
                                                    fontWeight: 'bold',
                                                    background: (h.tipo === 'ENTREGA' || h.tipo === 'TAXA') ? '#dcfce7' : '#fee2e2',
                                                    color: (h.tipo === 'ENTREGA' || h.tipo === 'TAXA') ? '#166534' : '#991b1b'
                                                }}>
                                                    {h.tipo}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '13px' }}>
                                                {h.tipo === 'ENTREGA' ? `Pedido #${h.pedido_id}` : (h.descricao || 'Pagamento de Saldo')}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold', color: (h.tipo === 'ENTREGA' || h.tipo === 'TAXA') ? '#27ae60' : '#e74c3c' }}>
                                                {h.tipo === 'ENTREGA' || h.tipo === 'TAXA' ? '+' : '-'} R$ {Math.abs(Number(h.valor)).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL DE AJUSTE MANUAL */}
            {showAjuste && selectedEntregador && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', width: '90%', maxWidth: '400px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0 }}>Ajuste Manual: {selectedEntregador.nome}</h3>
                            <button onClick={() => setShowAjuste(false)} style={{ background: '#eee', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer' }}>&times;</button>
                        </div>
                        
                        <p style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>
                            Adicione ou remova valores do saldo deste motoboy por motivos excepcionais (troca de pedido, caixinha, etc).
                        </p>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Valor do Ajuste (Ex: 5 ou -10)</label>
                            <input 
                                type="number" 
                                step="0.01"
                                placeholder="R$ 0,00"
                                value={valorAjuste} 
                                onChange={ev => setValorAjuste(ev.target.value)} 
                                style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} 
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Motivo / Descrição</label>
                            <input 
                                type="text" 
                                placeholder="Ex: Correção de pedido #321"
                                value={descAjuste} 
                                onChange={ev => setDescAjuste(ev.target.value)} 
                                style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} 
                            />
                        </div>

                        <button 
                            onClick={handleProcessAjuste}
                            style={{ background: '#8e44ad', color: '#fff', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}
                        >
                            SALVAR AJUSTE
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EntregadorAdmin;
