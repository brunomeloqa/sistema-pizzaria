// src/App.js (Versão Simplificada para Demonstração)
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import CardapioAdmin from './components/CardapioAdmin';
import Dashboard from './components/Dashboard';
import PedidoNovo from './components/PedidoNovo';
import MonitorCozinha from './components/MonitorCozinha';
import './index.css';


function App() {
    // 1. Estado para saber se o usuário está autenticado e qual a role
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userRole, setUserRole] = useState(null);
    const [userTelas, setUserTelas] = useState([]);

    // 2. Verifica o localStorage ao carregar (Recupera o login)
    useEffect(() => {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');
        const telas = localStorage.getItem('telas');
        if (token && role) {
            setIsAuthenticated(true);
            setUserRole(role);
            try { setUserTelas(JSON.parse(telas || '[]')); } catch(e) { setUserTelas([]); }
        }
    }, []);

    const handleLoginSuccess = (role, telas) => {
        setIsAuthenticated(true);
        setUserRole(role);
        setUserTelas(telas || []);
    };
    
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('telas');
        setIsAuthenticated(false);
        setUserRole(null);
        setUserTelas([]);
    };

    return (
        <div className="App">
            <h1>Sistema de Pizzaria</h1>
            {isAuthenticated 
                ? <Dashboard userRole={userRole} userTelas={userTelas} onLogout={handleLogout} />
                : <Login onLoginSuccess={handleLoginSuccess} />
            }
        </div>
    );
}

export default App;