// src/components/Login.js
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

const Login = ({ onLoginSuccess }) => {
    // 1. Estados
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [erro, setErro] = useState('');

    // 2. Manipulação do Formulário
    const handleSubmit = async (e) => {
        e.preventDefault();
        setErro(''); // Limpa mensagens de erro anteriores

        try {
            // Chamada para a rota de login no backend
            const response = await apiService.login({ username, password });
            
            // 3. Sucesso no Login
            const { token, role, telas } = response.data;
            
            console.log('✅ Login bem-sucedido. Token:', token);
            console.log('✅ Role:', role);
            console.log('✅ Telas:', telas);
            
            localStorage.setItem('token', token);
            localStorage.setItem('role', role);
            localStorage.setItem('telas', JSON.stringify(telas || []));

            // Informa o componente App.js que o login foi realizado
            onLoginSuccess(role, telas || []); 
            
        } catch (error) {
            // 4. Erro no Login (ex: credenciais inválidas, status 401)
            const mensagemErro = error.response?.data?.error || 'Erro de conexão ou credenciais inválidas.';
            setErro(mensagemErro);
            console.error('❌ Erro no login:', mensagemErro);
        }
    };

    // 5. Renderização
    return (
        <div className="login-container">
            <h2>🔐 Acesso Restrito</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>Usuário:</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label>Senha:</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button type="submit">Entrar</button>
            </form>
            {erro && <p style={{ color: 'red' }}>{erro}</p>}
        </div>
    );
};

export default Login;