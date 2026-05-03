import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

const UserManagementAdmin = ({ setMessage }) => {
    const [users, setUsers] = useState([]);
    const [perfis, setPerfis] = useState([]);
    const [newUserForm, setNewUserForm] = useState({ username: '', password: '', perfil_id: '' });

    useEffect(() => {
        fetchUsers();
        fetchPerfis();
    }, []); 

    const fetchUsers = async () => {
        try {
            const response = await apiService.listarUsuarios();
            setUsers(response.data.data);
            setMessage('');
        } catch (error) {
            const errorMessage = error.response?.data?.error || 'Erro de conexão ou autenticação ao carregar usuários.';
            setMessage(`Erro ao carregar lista de usuários: ${errorMessage}`);
            setUsers([]);
        }
    };

    const fetchPerfis = async () => {
        try {
            const response = await apiService.listarPerfis();
            const data = response.data.data || [];
            setPerfis(data);
            if (data.length > 0 && !newUserForm.perfil_id) {
                setNewUserForm(prev => ({ ...prev, perfil_id: data[0].id }));
            }
        } catch (error) {
            console.error('Erro ao carregar perfis:', error);
        }
    };
    
    const handleNewUserChange = (e) => {
        const { name, value } = e.target;
        setNewUserForm(prevForm => ({ ...prevForm, [name]: value }));
    };
    
    const handleAddUser = async (e) => {
        e.preventDefault();
        try {
            await apiService.addUser({ 
                username: newUserForm.username, 
                password: newUserForm.password, 
                perfil_id: parseInt(newUserForm.perfil_id)
            });
            setMessage(`Usuário ${newUserForm.username} adicionado.`);
            setNewUserForm({ username: '', password: '', perfil_id: perfis.length > 0 ? perfis[0].id : '' });
            fetchUsers();
        } catch (error) {
            setMessage(error.response?.data?.error || 'Erro ao adicionar usuário.');
        }
    };

    const handleDeleteUser = async (id, username) => {
        if (!window.confirm(`Tem certeza que deseja deletar o usuário ${username}?`)) return;

        try {
            await apiService.deleteUser(id);
            setMessage(`Usuário ${username} deletado.`);
            fetchUsers();
        } catch (error) {
            setMessage(error.response?.data?.error || 'Erro ao deletar usuário.');
        }
    };

    return (
        <>
            <h3>Adicionar Novo Usuário</h3>
            <form onSubmit={handleAddUser} style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                    <label>Usuário:</label>
                    <input name="username" value={newUserForm.username} onChange={handleNewUserChange} required />
                </div>
                <div style={{ flex: 1 }}>
                    <label>Senha:</label>
                    <input name="password" type="password" value={newUserForm.password} onChange={handleNewUserChange} required />
                </div>
                <div style={{ flex: 1 }}>
                    <label>Perfil:</label>
                    <select name="perfil_id" value={newUserForm.perfil_id} onChange={handleNewUserChange}>
                        {perfis.map(p => (
                            <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                    </select>
                </div>
                <button type="submit">Adicionar</button>
            </form>

            <hr />

            <h3>Usuários Ativos</h3>
            <table className="clientes-table"> 
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Usuário</th>
                        <th>Perfil</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user.id}>
                            <td>{user.id}</td>
                            <td>{user.username}</td>
                            <td>{user.perfil_nome || user.role}</td>
                            <td>
                                {user.id !== 1 && ( 
                                    <button 
                                        onClick={() => handleDeleteUser(user.id, user.username)} 
                                        className="btn-delete"
                                    >
                                        Deletar
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
};

export default UserManagementAdmin;