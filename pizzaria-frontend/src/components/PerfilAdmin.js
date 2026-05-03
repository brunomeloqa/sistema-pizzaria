import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

const TELA_LABELS = {
    'FLUXO_CAIXA':       '💰 Fluxo de Caixa',
    'NOVO_PEDIDO':       '📝 Novo Pedido',
    'MONITOR_COZINHA':   '🍳 Monitor Cozinha',
    'SALAO':             '🪑 Salão',
    'ADMIN_CLIENTES':    '👥 Cadastro Clientes',
    'ADMIN_PRODUTOS':    '⚙️ Admin. Cardápio',
    'ADMIN_ENTREGADORES':'🛵 Entregadores',
    'ADMIN_RELATORIOS':  '📊 Relatórios',
    'ADMIN_CONFIG':      '⚙️ Configurações',
};

const ALL_TELAS = Object.keys(TELA_LABELS);

const PerfilAdmin = ({ setMessage }) => {
    const [perfis, setPerfis] = useState([]);
    const [editingPerfil, setEditingPerfil] = useState(null);
    const [formNome, setFormNome] = useState('');
    const [formTelas, setFormTelas] = useState([]);

    useEffect(() => { fetchPerfis(); }, []);

    const fetchPerfis = async () => {
        try {
            const res = await apiService.listarPerfis();
            setPerfis(res.data.data || []);
        } catch (err) {
            setMessage('Erro ao carregar perfis.');
        }
    };

    const resetForm = () => {
        setEditingPerfil(null);
        setFormNome('');
        setFormTelas([]);
    };

    const handleToggleTela = (tela) => {
        setFormTelas(prev => 
            prev.includes(tela) ? prev.filter(t => t !== tela) : [...prev, tela]
        );
    };

    const handleSelectAll = () => {
        setFormTelas(formTelas.length === ALL_TELAS.length ? [] : [...ALL_TELAS]);
    };

    const handleEdit = (perfil) => {
        setEditingPerfil(perfil);
        setFormNome(perfil.nome);
        setFormTelas(perfil.telas || []);
    };

    const handleSave = async () => {
        if (!formNome.trim()) return setMessage('O nome do perfil é obrigatório.');
        if (formTelas.length === 0) return setMessage('Selecione pelo menos uma tela.');

        try {
            if (editingPerfil) {
                await apiService.atualizarPerfil(editingPerfil.id, { nome: formNome, telas: formTelas });
                setMessage('✅ Perfil atualizado!');
            } else {
                await apiService.criarPerfil({ nome: formNome, telas: formTelas });
                setMessage('✅ Perfil criado!');
            }
            resetForm();
            fetchPerfis();
        } catch (err) {
            setMessage('❌ ' + (err.response?.data?.error || 'Erro ao salvar perfil.'));
        }
    };

    const handleDelete = async (perfil) => {
        if (!window.confirm(`Tem certeza que deseja deletar o perfil "${perfil.nome}"?`)) return;
        try {
            await apiService.deletarPerfil(perfil.id);
            setMessage('✅ Perfil deletado!');
            fetchPerfis();
        } catch (err) {
            setMessage('❌ ' + (err.response?.data?.error || 'Erro ao deletar perfil.'));
        }
    };

    return (
        <div>
            <h3>Gerenciar Perfis de Acesso</h3>
            <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px' }}>
                Crie perfis personalizados e defina quais telas do sistema cada perfil pode acessar. Ao criar um usuário, você associa um perfil.
            </p>

            {/* LISTA DE PERFIS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {perfis.map(perfil => {
                    const isAdmin = perfil.id === 1;
                    return (
                        <div key={perfil.id} style={{
                            padding: '16px', border: '1px solid #ddd', borderRadius: '10px',
                            background: isAdmin ? '#e8f5e9' : '#f8f9fa',
                            borderColor: isAdmin ? '#4caf50' : '#ddd'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <strong style={{ fontSize: '16px' }}>
                                    {isAdmin ? '👑' : '👤'} {perfil.nome}
                                </strong>
                                {!isAdmin && (
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button 
                                            onClick={() => handleEdit(perfil)} 
                                            className="btn-primary"
                                            style={{ padding: '4px 10px', fontSize: '12px' }}
                                        >
                                            ✏️ Editar
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(perfil)} 
                                            className="btn-danger"
                                            style={{ padding: '4px 10px', fontSize: '12px' }}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {(perfil.telas || []).map(tela => (
                                    <span key={tela} style={{
                                        background: '#e3f2fd', color: '#1565c0',
                                        padding: '2px 8px', borderRadius: '12px',
                                        fontSize: '11px', fontWeight: 'bold'
                                    }}>
                                        {TELA_LABELS[tela] || tela}
                                    </span>
                                ))}
                            </div>
                            {isAdmin && (
                                <p style={{ color: '#4caf50', fontSize: '11px', margin: '6px 0 0', fontStyle: 'italic' }}>
                                    🔒 Perfil protegido — acesso total
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* FORMULÁRIO DE CRIAÇÃO/EDIÇÃO */}
            <div style={{ padding: '20px', border: '2px solid #e67e22', borderRadius: '10px', background: '#fff8f0' }}>
                <h4 style={{ margin: '0 0 12px' }}>
                    {editingPerfil ? `✏️ Editando: ${editingPerfil.nome}` : '➕ Novo Perfil'}
                </h4>

                <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Nome do Perfil:</label>
                    <input 
                        type="text" 
                        value={formNome} 
                        onChange={e => setFormNome(e.target.value)}
                        placeholder="Ex: Garçom, Caixa, Gerente..."
                        style={{ padding: '8px 12px', width: '300px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px' }}
                    />
                </div>

                <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ fontWeight: 'bold' }}>Telas com Acesso:</label>
                        <button 
                            onClick={handleSelectAll} 
                            type="button"
                            style={{ background: 'none', border: '1px solid #999', padding: '3px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                        >
                            {formTelas.length === ALL_TELAS.length ? 'Desmarcar Todas' : 'Marcar Todas'}
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
                        {ALL_TELAS.map(tela => (
                            <label key={tela} style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                                background: formTelas.includes(tela) ? '#e3f2fd' : '#fff',
                                border: `1px solid ${formTelas.includes(tela) ? '#1976d2' : '#ddd'}`,
                                transition: 'all 0.2s'
                            }}>
                                <input 
                                    type="checkbox" 
                                    checked={formTelas.includes(tela)}
                                    onChange={() => handleToggleTela(tela)}
                                />
                                <span style={{ fontSize: '13px' }}>{TELA_LABELS[tela]}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={handleSave} className="btn-success" style={{ padding: '10px 24px' }}>
                        {editingPerfil ? '💾 Salvar Alterações' : '➕ Criar Perfil'}
                    </button>
                    {editingPerfil && (
                        <button onClick={resetForm} className="btn-danger" style={{ padding: '10px 24px' }}>
                            Cancelar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PerfilAdmin;
