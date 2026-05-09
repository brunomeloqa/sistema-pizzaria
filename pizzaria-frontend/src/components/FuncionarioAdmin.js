import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

const FuncionarioAdmin = () => {
    const [funcionarios, setFuncionarios] = useState([]);
    const [produtos, setProdutos] = useState([]);
    const [nome, setNome] = useState('');
    const [funcao, setFuncao] = useState('');
    const [tipoPagamento, setTipoPagamento] = useState('Mensal');
    const [valorPagamento, setValorPagamento] = useState('');
    const [mensagem, setMensagem] = useState('');

    const [editingId, setEditingId] = useState(null);
    const [editNome, setEditNome] = useState('');
    const [editFuncao, setEditFuncao] = useState('');
    const [editTipoPagamento, setEditTipoPagamento] = useState('');
    const [editValorPagamento, setEditValorPagamento] = useState('');

    const [showLancamento, setShowLancamento] = useState(false);
    const [showHistorico, setShowHistorico] = useState(false);
    const [selectedFuncionario, setSelectedFuncionario] = useState(null);
    
    // States for Lancamento
    const [lancCategoria, setLancCategoria] = useState('Diária'); // Diária, Salário, Vale, Pagamento, Produto
    const [lancQuantidade, setLancQuantidade] = useState(1);
    const [lancValorTotal, setLancValorTotal] = useState('');
    const [lancDescricao, setLancDescricao] = useState('');
    const [lancProdutoId, setLancProdutoId] = useState('');
    const [historico, setHistorico] = useState([]);

    const fetchFuncionarios = async () => {
        try {
            const res = await apiService.listarFuncionarios();
            setFuncionarios(res.data || []);
        } catch (error) {
            console.error("Erro ao buscar funcionarios:", error);
            setMensagem("Erro ao carregar funcionários.");
        }
    };

    const fetchProdutos = async () => {
        try {
            const res = await apiService.listarProdutos({ limite: 1000 });
            setProdutos(res.data.data || res.data || []);
        } catch (error) {
            console.error("Erro ao buscar produtos:", error);
        }
    };

    useEffect(() => {
        fetchFuncionarios();
        fetchProdutos();
    }, []);

    const handleAddFuncionario = async (e) => {
        e.preventDefault();
        try {
            await apiService.criarFuncionario({ 
                nome, 
                funcao, 
                tipo_pagamento: tipoPagamento, 
                valor_pagamento: parseFloat(valorPagamento) || 0 
            });
            setMensagem(`Funcionário ${nome} salvo com sucesso!`);
            setNome('');
            setFuncao('');
            setValorPagamento('');
            fetchFuncionarios();
            setTimeout(() => setMensagem(''), 3000);
        } catch (error) {
            setMensagem("Erro ao adicionar funcionário.");
        }
    };

    const handleToggleAtivo = async (id, currentStatus) => {
        try {
            await apiService.atualizarFuncionario(id, { ativo: currentStatus ? 0 : 1 });
            fetchFuncionarios();
        } catch (error) {
            setMensagem("Erro ao alterar status.");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Tem certeza que deseja desativar/excluir este funcionário?")) return;
        try {
            await apiService.deletarFuncionario(id);
            setMensagem("Funcionário desativado!");
            fetchFuncionarios();
            setTimeout(() => setMensagem(''), 3000);
        } catch (error) {
            setMensagem("Erro ao desativar funcionário.");
        }
    };

    const handleEditClick = (f) => {
        setEditingId(f.id);
        setEditNome(f.nome);
        setEditFuncao(f.funcao || '');
        setEditTipoPagamento(f.tipo_pagamento || 'Mensal');
        setEditValorPagamento(f.valor_pagamento || '');
    };

    const handleSaveEdit = async (id) => {
        try {
            await apiService.atualizarFuncionario(id, { 
                nome: editNome, 
                funcao: editFuncao, 
                tipo_pagamento: editTipoPagamento, 
                valor_pagamento: parseFloat(editValorPagamento) || 0 
            });
            setMensagem("Dados atualizados com sucesso!");
            setEditingId(null);
            fetchFuncionarios();
            setTimeout(() => setMensagem(''), 3000);
        } catch (error) {
            setMensagem("Erro ao atualizar funcionário.");
        }
    };

    const handleOpenLancamento = (f) => {
        setSelectedFuncionario(f);
        setLancCategoria('Diária');
        setLancQuantidade(1);
        if (f.tipo_pagamento === 'Diária') {
            setLancValorTotal(f.valor_pagamento || '');
        } else {
            setLancCategoria('Salário');
            setLancValorTotal(f.valor_pagamento || '');
        }
        setLancDescricao('');
        setLancProdutoId('');
        setShowLancamento(true);
    };

    const handleSaveLancamento = async (e) => {
        e.preventDefault();
        if (!lancValorTotal || parseFloat(lancValorTotal) <= 0) return alert("Informe um valor válido.");

        let tipo = 'Crédito';
        if (['Vale', 'Pagamento', 'Produto'].includes(lancCategoria)) {
            tipo = 'Débito';
        }

        let finalDescricao = lancDescricao;
        if (lancCategoria === 'Diária' && lancQuantidade > 1) {
            finalDescricao = `${lancQuantidade} diárias. ${lancDescricao}`;
        }

        try {
            await apiService.addLancamentoFuncionario(selectedFuncionario.id, {
                tipo,
                categoria: lancCategoria,
                valor: parseFloat(lancValorTotal),
                descricao: finalDescricao,
                produto_id: lancCategoria === 'Produto' ? lancProdutoId : null
            });
            setMensagem("Lançamento registrado com sucesso!");
            setShowLancamento(false);
            fetchFuncionarios();
            setTimeout(() => setMensagem(''), 3000);
        } catch (error) {
            setMensagem("Erro ao registrar lançamento.");
        }
    };

    const handleOpenHistorico = async (f) => {
        setSelectedFuncionario(f);
        setShowHistorico(true);
        try {
            const res = await apiService.getLancamentosFuncionario(f.id);
            setHistorico(res.data || []);
        } catch (error) {
            console.error("Erro ao buscar histórico:", error);
        }
    };

    const onCategoriaChange = (cat) => {
        setLancCategoria(cat);
        setLancDescricao('');
        setLancProdutoId('');
        setLancQuantidade(1);
        
        if (cat === 'Diária') {
            let base = selectedFuncionario?.valor_pagamento || 0;
            if (selectedFuncionario?.tipo_pagamento === 'Mensal') {
                base = base / 30;
            }
            setLancValorTotal(base ? Number(base).toFixed(2) : '');
        } else if (cat === 'Salário') {
            setLancValorTotal(selectedFuncionario?.valor_pagamento || '');
        } else {
            setLancValorTotal('');
        }
    };

    const onProdutoChange = (prodId) => {
        setLancProdutoId(prodId);
        setLancQuantidade(1);
        const prod = produtos.find(p => p.id === parseInt(prodId));
        if (prod) {
            setLancValorTotal(prod.preco);
            setLancDescricao(`Consumo: ${prod.nome}`);
        }
    };

    const handleQuantidadeChange = (qtd) => {
        const val = parseInt(qtd) || 1;
        setLancQuantidade(val);
        
        if (lancCategoria === 'Diária') {
            let diariaBase = selectedFuncionario?.valor_pagamento || 0;
            if (selectedFuncionario?.tipo_pagamento === 'Mensal') {
                diariaBase = diariaBase / 30;
            }
            setLancValorTotal((diariaBase * val).toFixed(2));
        } else if (lancCategoria === 'Salário') {
            setLancValorTotal(selectedFuncionario?.valor_pagamento || '');
        } else if (lancCategoria === 'Produto' && lancProdutoId) {
            const prod = produtos.find(p => p.id === parseInt(lancProdutoId));
            if (prod) {
                setLancValorTotal(prod.preco * val);
                setLancDescricao(`Consumo: ${val}x ${prod.nome}`);
            }
        }
    };

    return (
        <div className="admin-container" style={{ padding: '20px' }}>
            <h2>👨‍🍳 Cadastro de Funcionários</h2>
            {mensagem && <div className="alert">{mensagem}</div>}

            <form onSubmit={handleAddFuncionario} style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '20px', alignItems: 'center', background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
                <input 
                    type="text" 
                    placeholder="Nome do Funcionário" 
                    value={nome} 
                    onChange={(e) => setNome(e.target.value)} 
                    required 
                    style={{ flex: '2', minWidth: '200px', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                />
                <input 
                    type="text" 
                    placeholder="Função (Ex: Pizzaiolo)" 
                    value={funcao} 
                    onChange={(e) => setFuncao(e.target.value)} 
                    style={{ flex: '1.5', minWidth: '150px', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                />
                <select 
                    value={tipoPagamento} 
                    onChange={(e) => setTipoPagamento(e.target.value)}
                    style={{ flex: '1', minWidth: '120px', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                >
                    <option value="Mensal">Mensal</option>
                    <option value="Diária">Diária</option>
                </select>
                <input 
                    type="number" 
                    step="0.01"
                    placeholder={tipoPagamento === 'Diária' ? "Valor da Diária" : "Salário Base"} 
                    value={valorPagamento} 
                    onChange={(e) => setValorPagamento(e.target.value)} 
                    style={{ flex: '1', minWidth: '120px', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                />
                <button type="submit" className="btn-success" style={{ padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}>
                    ✚ Adicionar
                </button>
            </form>

            <div className="table-responsive">
                <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f4f4f4', textAlign: 'left' }}>
                            <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Status</th>
                            <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Nome</th>
                            <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Função</th>
                            <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Pagamento</th>
                            <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Saldo</th>
                            <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {funcionarios.length === 0 ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>Nenhum funcionário cadastrado.</td></tr>
                        ) : (
                            funcionarios.map(f => (
                                <tr key={f.id} style={{ opacity: f.ativo ? 1 : 0.6, borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '10px' }}>
                                        <button 
                                            onClick={() => handleToggleAtivo(f.id, f.ativo)}
                                            style={{ 
                                                padding: '5px 10px', borderRadius: '20px', border: 'none', color: '#fff', cursor: 'pointer',
                                                background: f.ativo ? '#2ecc71' : '#e74c3c' 
                                            }}
                                        >
                                            {f.ativo ? 'Ativo' : 'Inativo'}
                                        </button>
                                    </td>
                                    <td style={{ padding: '10px', fontWeight: 'bold' }}>
                                        {editingId === f.id ? (
                                            <input type="text" value={editNome} onChange={ev => setEditNome(ev.target.value)} style={{ padding: '5px', width: '100%' }} />
                                        ) : f.nome}
                                    </td>
                                    <td style={{ padding: '10px' }}>
                                        {editingId === f.id ? (
                                            <input type="text" value={editFuncao} onChange={ev => setEditFuncao(ev.target.value)} style={{ padding: '5px', width: '100%' }} />
                                        ) : (f.funcao || '-')}
                                    </td>
                                    <td style={{ padding: '10px' }}>
                                        {editingId === f.id ? (
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <select value={editTipoPagamento} onChange={ev => setEditTipoPagamento(ev.target.value)} style={{ padding: '5px' }}>
                                                    <option value="Mensal">Mensal</option>
                                                    <option value="Diária">Diária</option>
                                                </select>
                                                <input type="number" value={editValorPagamento} onChange={ev => setEditValorPagamento(ev.target.value)} style={{ padding: '5px', width: '80px' }} />
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '13px' }}>
                                                {f.tipo_pagamento}: R$ {Number(f.valor_pagamento || 0).toFixed(2)}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '10px' }}>
                                        <span style={{ color: f.saldo < 0 ? '#e74c3c' : (f.saldo > 0 ? '#27ae60' : '#333'), fontWeight: 'bold', fontSize: '16px' }}>
                                            R$ {Number(f.saldo || 0).toFixed(2)}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                        {editingId === f.id ? (
                                            <>
                                                <button onClick={() => handleSaveEdit(f.id)} style={{ padding: '5px 10px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Salvar</button>
                                                <button onClick={() => setEditingId(null)} style={{ padding: '5px 10px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => handleOpenLancamento(f)} style={{ padding: '5px 10px', background: '#9b59b6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                                                    + Lançar
                                                </button>
                                                <button onClick={() => handleOpenHistorico(f)} style={{ padding: '5px 10px', background: '#34495e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                                                    Histórico
                                                </button>
                                                <button onClick={() => handleEditClick(f)} style={{ padding: '5px 10px', background: 'transparent', color: '#3498db', border: '1px solid #3498db', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Editar</button>
                                                <button onClick={() => handleDelete(f.id)} style={{ padding: '5px 10px', background: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Excluir</button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL DE LANÇAMENTO */}
            {showLancamento && selectedFuncionario && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', width: '90%', maxWidth: '400px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0 }}>Lançamento: {selectedFuncionario.nome}</h3>
                            <button onClick={() => setShowLancamento(false)} style={{ background: '#eee', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer' }}>&times;</button>
                        </div>
                        
                        <form onSubmit={handleSaveLancamento}>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Categoria</label>
                                <select 
                                    value={lancCategoria} 
                                    onChange={(e) => onCategoriaChange(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                                >
                                    <option value="Diária">Adicionar Diária (Crédito)</option>
                                    <option value="Salário">Adicionar Salário Mensal (Crédito)</option>
                                    <option value="Vale">Vale / Adiantamento (Débito)</option>
                                    <option value="Pagamento">Pagamento de Saldo (Débito)</option>
                                    <option value="Produto">Consumo de Produto (Débito)</option>
                                </select>
                            </div>

                            {lancCategoria === 'Produto' && (
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Selecionar Produto</label>
                                    <select 
                                        value={lancProdutoId} 
                                        onChange={(e) => onProdutoChange(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                                        required
                                    >
                                        <option value="">-- Escolha --</option>
                                        {produtos.map(p => (
                                            <option key={p.id} value={p.id}>{p.nome} - R$ {Number(p.preco).toFixed(2)}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {(lancCategoria === 'Diária' || lancCategoria === 'Produto') && (
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>
                                        {lancCategoria === 'Diária' ? 'Qtd de Dias Trabalhados' : 'Quantidade'}
                                    </label>
                                    <input 
                                        type="number" 
                                        min="1"
                                        value={lancQuantidade} 
                                        onChange={ev => handleQuantidadeChange(ev.target.value)} 
                                        style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} 
                                        required
                                    />
                                </div>
                            )}

                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Valor Total (R$)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={lancValorTotal} 
                                    onChange={ev => setLancValorTotal(ev.target.value)} 
                                    style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} 
                                    required
                                />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Descrição (Opcional)</label>
                                <input 
                                    type="text" 
                                    placeholder="Detalhes..."
                                    value={lancDescricao} 
                                    onChange={ev => setLancDescricao(ev.target.value)} 
                                    style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} 
                                />
                            </div>

                            <button 
                                type="submit"
                                style={{ background: ['Diária', 'Salário'].includes(lancCategoria) ? '#27ae60' : '#e74c3c', color: '#fff', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}
                            >
                                CONFIRMAR LANÇAMENTO
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DE HISTÓRICO */}
            {showHistorico && selectedFuncionario && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', width: '90%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>Extrato de {selectedFuncionario.nome}</h3>
                            <button onClick={() => setShowHistorico(false)} style={{ background: '#eee', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer' }}>&times;</button>
                        </div>

                        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                            <span style={{ fontSize: '14px', color: '#666' }}>Saldo Atual</span>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: selectedFuncionario.saldo < 0 ? '#e74c3c' : '#27ae60' }}>
                                R$ {Number(selectedFuncionario.saldo).toFixed(2)}
                            </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                                    <th style={{ padding: '10px' }}>Data</th>
                                    <th>Categoria</th>
                                    <th>Descrição</th>
                                    <th style={{ textAlign: 'right' }}>Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historico.length === 0 ? (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Nenhuma movimentação.</td></tr>
                                ) : (
                                    historico.map((h, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '10px', fontSize: '13px' }}>
                                                {new Date(h.data_lancamento).toLocaleDateString('pt-BR')} {new Date(h.data_lancamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td>
                                                <span style={{ 
                                                    padding: '2px 6px', 
                                                    borderRadius: '4px', 
                                                    fontSize: '11px', 
                                                    fontWeight: 'bold',
                                                    background: h.tipo === 'Crédito' ? '#dcfce7' : '#fee2e2',
                                                    color: h.tipo === 'Crédito' ? '#166534' : '#991b1b'
                                                }}>
                                                    {h.categoria}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '13px' }}>
                                                {h.produto_nome ? `Consumo: ${h.produto_nome}` : h.descricao || '-'}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold', color: h.tipo === 'Crédito' ? '#27ae60' : '#e74c3c' }}>
                                                {h.tipo === 'Crédito' ? '+' : '-'} R$ {Math.abs(Number(h.valor)).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FuncionarioAdmin;
