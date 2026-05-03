// src/components/ProdutoAdmin.js
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

const formatarMoeda = (valor) => {
    return Number(valor).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
};


const ProdutoAdmin = () => {
    const [produtos, setProdutos] = useState([]);
    const [mensagem, setMensagem] = useState('');
    
    // Filtros de Busca
    const [filtros, setFiltros] = useState({ busca: '', grupo: 'Todos', estado: 'todos' });

    // Formulário
    const initialFormState = { 
        nome: '', preco: '', preco_broto: '', 
        categoria: 'Pizza', descricao: '', ativo: 1, is_taxa: 0 
    };
    const [form, setForm] = useState(initialFormState);
    const [editandoId, setEditandoId] = useState(null);

    const categorias = ['Pizza', 'Bebida', 'Sobremesa', 'Esfiha', 'Outros'];

    useEffect(() => { 
        carregarProdutos(); 
    }, [filtros]); // Recarrega sempre que um filtro mudar

    const carregarProdutos = async () => {
        try {
            // Mapeamos os filtros para os nomes que o backend espera
            const params = {
                nome: filtros.busca,
                categoria: filtros.grupo,
                estado: filtros.estado
            };
            // Se a busca for numérica, o backend tratará como código (ID)
            if (!isNaN(filtros.busca) && filtros.busca !== '') {
                params.codigo = filtros.busca;
            }

            const res = await apiService.listarProdutos(params);
            setProdutos(res.data.data);
        } catch (err) {
            setMensagem('Erro ao carregar produtos.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const dadosParaEnviar = {
                ...form,
                preco: parseFloat(form.preco),
                preco_broto: form.categoria === 'Pizza' ? parseFloat(form.preco_broto || 0) : 0,
                ativo: parseInt(form.ativo),
                is_taxa: form.is_taxa ? 1 : 0
            };

            if (editandoId) {
                await apiService.atualizarProduto(editandoId, dadosParaEnviar);
                setMensagem('✅ Produto atualizado!');
            } else {
                await apiService.criarProduto(dadosParaEnviar);
                setMensagem('✅ Produto criado!');
            }
            setForm(initialFormState);
            setEditandoId(null);
            carregarProdutos();
        } catch (err) {
            setMensagem('❌ Erro ao salvar produto.');
        }
    };

    const handleToggleAtivo = async (produto) => {
        try {
            const novoEstado = produto.ativo === 1 ? 0 : 1;
            await apiService.atualizarProduto(produto.id, { ...produto, ativo: novoEstado });
            carregarProdutos();
        } catch (err) { console.error("Erro ao mudar status"); }
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <style>{`
                .admin-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 25px; }
                .filter-bar { background: #f8f9fa; padding: 15px; border-radius: 8px; display: flex; gap: 10px; margin-bottom: 20px; border: 1px solid #dee2e6; align-items: flex-end; }
                .status-badge { padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
                .status-ativo { background: #d4edda; color: #155724; }
                .status-inativo { background: #f8d7da; color: #721c24; }
                .btn-edit { background: #ffc107; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px; }
                .btn-status { border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; color: white; }
            `}</style>

            <h2>📦 Gestão de Cardápio</h2>

            {/* FORMULÁRIO DE CADASTRO */}
            <form onSubmit={handleSubmit} className="admin-grid">
                <h3 style={{ gridColumn: 'span 4', margin: 0 }}>{editandoId ? 'Editar Produto' : 'Novo Produto'}</h3>
                
                <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Nome do Produto</label>
                    <input style={{ width: '100%', padding: '8px' }} type="text" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} required />
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Categoria</label>
                    <select style={{ width: '100%', padding: '8px' }} value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}>
                        {categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Status</label>
                    <select style={{ width: '100%', padding: '8px' }} value={form.ativo} onChange={e => setForm({...form, ativo: e.target.value})}>
                        <option value={1}>Ativo</option>
                        <option value={0}>Desativado</option>
                    </select>
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Preço {form.categoria === 'Pizza' ? '(Grande)' : ''}</label>
                    <input style={{ width: '100%', padding: '8px' }} type="number" step="0.01" value={form.preco} onChange={e => setForm({...form, preco: e.target.value})} required />
                </div>

                {form.categoria === 'Pizza' && (
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Preço Broto</label>
                        <input style={{ width: '100%', padding: '8px' }} type="number" step="0.01" value={form.preco_broto} onChange={e => setForm({...form, preco_broto: e.target.value})} />
                    </div>
                )}

                <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Descrição / Ingredientes</label>
                    <input style={{ width: '100%', padding: '8px' }} type="text" value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                        type="checkbox" 
                        id="is_taxa" 
                        checked={form.is_taxa === 1} 
                        onChange={e => setForm({...form, is_taxa: e.target.checked ? 1 : 0})} 
                    />
                    <label htmlFor="is_taxa" style={{ fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>É uma Taxa de Entrega?</label>
                </div>

                <div style={{ gridColumn: 'span 4', display: 'flex', gap: '10px' }}>
                    <button type="submit" style={{ flex: 3, padding: '10px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                        {editandoId ? 'ATUALIZAR PRODUTO' : 'CADASTRAR NO CARDÁPIO'}
                    </button>
                    {editandoId && (
                        <button type="button" onClick={() => {setForm(initialFormState); setEditandoId(null);}} style={{ flex: 1, background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px' }}>CANCELAR</button>
                    )}
                </div>
            </form>

            {/* BARRA DE FILTROS */}
            <div className="filter-bar">
                <div style={{ flex: 2 }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>🔍 Busca (Nome ou Código)</label>
                    <input type="text" placeholder="Ex: Calabresa ou 102..." style={{ width: '100%', padding: '8px' }} 
                        value={filtros.busca} onChange={e => setFiltros({...filtros, busca: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Grupo</label>
                    <select style={{ width: '100%', padding: '8px' }} value={filtros.grupo} onChange={e => setFiltros({...filtros, grupo: e.target.value})}>
                        <option value="Todos">Todos os Grupos</option>
                        {categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Estado</label>
                    <select style={{ width: '100%', padding: '8px' }} value={filtros.estado} onChange={e => setFiltros({...filtros, estado: e.target.value})}>
                        <option value="todos">Todos (Ativos/Inativos)</option>
                        <option value="ativo">Somente Ativos</option>
                        <option value="desativado">Somente Inativos</option>
                    </select>
                </div>
            </div>

            {/* TABELA DE PRODUTOS */}
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                <thead>
                    <tr style={{ background: '#343a40', color: '#fff', textAlign: 'left' }}>
                        <th style={{ padding: '12px' }}>Cód.</th>
                        <th>Produto</th>
                        <th>Categoria</th>
                        <th>Preços</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {produtos.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #eee', opacity: p.ativo ? 1 : 0.6 }}>
                            <td style={{ padding: '12px' }}>#{p.id}</td>
                            <td>
                                <strong>{p.nome}</strong>
                                {p.is_taxa === 1 && <span style={{ marginLeft: '8px', background: '#e67e22', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>TAXA</span>}
                                <br/>
                                <small style={{ color: '#888' }}>{p.descricao}</small>
                            </td>
                            <td>{p.categoria}</td>
                            <td>
                                G: R$ {formatarMoeda(p.preco)}
                                {p.categoria === 'Pizza' && p.preco_broto > 0 && (
                                    <span> <br/> B: R$ {formatarMoeda(p.preco_broto)} </span>
                                )}
                            </td>
                            <td>
                                <span className={`status-badge ${p.ativo ? 'status-ativo' : 'status-inativo'}`}>
                                    {p.ativo ? 'Ativo' : 'Inativo'}
                                </span>
                            </td>
                            <td>
                                <button className="btn-edit" onClick={() => { setEditandoId(p.id); setForm(p); window.scrollTo(0,0); }}>✎</button>
                                <button className="btn-status" style={{ background: p.ativo ? '#dc3545' : '#28a745' }} onClick={() => handleToggleAtivo(p)}>
                                    {p.ativo ? 'Desativar' : 'Ativar'}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {mensagem && (
                <div style={{ position: 'fixed', bottom: '20px', right: '20px', background: '#333', color: '#fff', padding: '10px 20px', borderRadius: '30px' }}>
                    {mensagem}
                </div>
            )}
        </div>
    );
};

export default ProdutoAdmin;