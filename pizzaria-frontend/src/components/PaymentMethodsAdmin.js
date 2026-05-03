import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

const PaymentMethodsAdmin = ({ setMessage }) => {
    const [methods, setMethods] = useState([]);
    const [newMethodName, setNewMethodName] = useState('');

    useEffect(() => {
        fetchMethods();
    }, []);

    const fetchMethods = async () => {
        try {
            const response = await apiService.listarModosPagamento();
            setMethods(response.data.data);
            setMessage('');
        } catch (error) {
            setMessage('Erro ao carregar modos de pagamento.');
            console.error(error);
        }
    };

    const handleAddMethod = async (e) => {
        e.preventDefault();
        if (!newMethodName.trim()) {
            setMessage('O nome do modo de pagamento não pode ser vazio.');
            return;
        }

        try {
            await apiService.addPaymentMethod({ nome: newMethodName.trim() });
            setMessage(`Modo de pagamento "${newMethodName}" adicionado com sucesso.`);
            setNewMethodName('');
            fetchMethods(); 
        } catch (error) {
            setMessage(error.response?.data?.error || 'Erro ao adicionar modo de pagamento.');
        }
    };

    const handleDeleteMethod = async (id, nome) => {
        if (!window.confirm(`Tem certeza que deseja deletar o modo de pagamento "${nome}"?`)) return;

        try {
            await apiService.deletePaymentMethod(id);
            setMessage(`Modo de pagamento "${nome}" deletado.`);
            fetchMethods(); 
        } catch (error) {
            setMessage(error.response?.data?.error || 'Erro ao deletar modo de pagamento.');
        }
    };

    const handleToggleActive = async (method) => {
        const newStatus = method.ativo === 1 ? 0 : 1;
        try {
            await apiService.updatePaymentMethod(method.id, { ativo: newStatus });
            setMessage(`Modo "${method.nome}" ${newStatus === 1 ? 'ativado' : 'desativado'} com sucesso.`);
            fetchMethods(); 
        } catch (error) {
            setMessage(error.response?.data?.error || 'Erro ao atualizar modo de pagamento.');
        }
    };

    const handleToggleCupom = async (method) => {
        const newValue = method.is_cupom === 1 ? 0 : 1;
        try {
            await apiService.updatePaymentMethod(method.id, { is_cupom: newValue });
            setMessage(`Modo "${method.nome}" marcado como ${newValue === 1 ? 'Cupom' : 'Comum'}.`);
            fetchMethods();
        } catch (error) {
            setMessage(error.response?.data?.error || 'Erro ao atualizar modo de pagamento.');
        }
    };

    return (
        <div className="payment-methods-admin">
            <h3>Adicionar Novo Modo de Pagamento</h3>
            <form onSubmit={handleAddMethod} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input
                    type="text"
                    placeholder="Ex: Cartão de Crédito"
                    value={newMethodName}
                    onChange={(e) => setNewMethodName(e.target.value)}
                    required
                    style={{ flexGrow: 1 }}
                />
                <button type="submit">Adicionar</button>
            </form>

            <hr />

            <h3>Modos de Pagamento Ativos/Inativos</h3>
            <table className="clientes-table"> 
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {methods.map(method => (
                        <tr key={method.id}>
                            <td>{method.nome}</td>
                            <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <span>{method.ativo === 1 ? '✅ Ativo' : '❌ Inativo'}</span>
                                    <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', color: method.is_cupom === 1 ? '#e67e22' : '#666' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={method.is_cupom === 1} 
                                            onChange={() => handleToggleCupom(method)}
                                        />
                                        {method.is_cupom === 1 ? '🏷️ É Cupom (Pendura)' : 'Comum'}
                                    </label>
                                </div>
                            </td>
                            <td>
                                <button 
                                    onClick={() => handleToggleActive(method)}
                                    style={{ 
                                        marginRight: '10px', 
                                        backgroundColor: method.ativo === 1 ? '#e74c3c' : '#2ecc71',
                                        color: 'white',
                                        border: 'none',
                                        padding: '5px 10px',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {method.ativo === 1 ? 'Desativar' : 'Ativar'}
                                </button>
                                <button 
                                    onClick={() => handleDeleteMethod(method.id, method.nome)} 
                                    style={{ 
                                        backgroundColor: '#c0392b',
                                        color: 'white',
                                        border: 'none',
                                        padding: '5px 10px',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Excluir
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default PaymentMethodsAdmin;