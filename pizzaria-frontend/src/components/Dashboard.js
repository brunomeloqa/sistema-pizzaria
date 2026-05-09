// src/components/Dashboard.js
import React, { useState, useEffect } from 'react';

// Importa os componentes de tela
import PedidoNovo from './PedidoNovo';
import CardapioAdmin from './CardapioAdmin'; 
import MonitorCozinha from './MonitorCozinha';
import ClienteAdmin from './ClienteAdmin';
import ConfigAdmin from './ConfigAdmin';
import Relatorios from './Relatorios';
import SalaoMonitor from './SalaoMonitor';
import FluxoCaixa from './FluxoCaixa';
import EntregadorAdmin from './EntregadorAdmin';
import FuncionarioAdmin from './FuncionarioAdmin';

// Mapeamento de rotas (sem requiredRole — controle vem do perfil)
const ROUTE_MAP = {
    'FLUXO_CAIXA':       { component: FluxoCaixa,       label: ' Fluxo de Caixa' },
    'NOVO_PEDIDO':       { component: PedidoNovo,        label: '📝 Novo Pedido' },
    'MONITOR_COZINHA':   { component: MonitorCozinha,     label: '🍳 Monitor Cozinha' },
    'SALAO':             { component: SalaoMonitor,       label: '🪑 Salão' },
    'ADMIN_CLIENTES':    { component: ClienteAdmin,       label: '👥 Cadastro Clientes' },
    'ADMIN_PRODUTOS':    { component: CardapioAdmin,      label: '⚙️ Admin. Cardápio' },
    'ADMIN_ENTREGADORES':{ component: EntregadorAdmin,    label: '🛵 Entregadores' },
    'ADMIN_FUNCIONARIOS':{ component: FuncionarioAdmin,   label: '👨‍🍳 Funcionários' },
    'ADMIN_RELATORIOS':  { component: Relatorios,         label: '📊 Relatórios' },
    'ADMIN_CONFIG':      { component: ConfigAdmin,        label: '⚙️ Configurações' },
};

const Dashboard = ({ userRole, userTelas, onLogout }) => {
    const [activeRoute, setActiveRoute] = useState('FLUXO_CAIXA');

    // Filtra as rotas visíveis baseado nas telas do perfil
    const getAvailableRoutes = () => {
        // Admin vê tudo
        if (userRole === 'admin') {
            return Object.keys(ROUTE_MAP);
        }
        // Outros perfis: só as telas permitidas
        return Object.keys(ROUTE_MAP).filter(key => userTelas && userTelas.includes(key));
    };

    // Garante que a rota ativa esteja nas disponíveis
    useEffect(() => {
        const available = getAvailableRoutes();
        if (available.length > 0 && !available.includes(activeRoute)) {
            setActiveRoute(available[0]);
        }
    }, [userTelas]);

    const renderActiveComponent = () => {
        const route = ROUTE_MAP[activeRoute];
        const available = getAvailableRoutes();
        if (!route || !available.includes(activeRoute)) {
            return <p>Selecione uma opção no menu.</p>;
        }
        const Component = route.component;
        return <Component />;
    };

    return (
        <div className="dashboard-layout">
            <div className="sidebar">
                <h2>Menu ({userRole})</h2>
                {getAvailableRoutes().map(key => (
                    <button 
                        key={key}
                        className={key === activeRoute ? 'active' : ''}
                        onClick={() => setActiveRoute(key)}
                    >
                        {ROUTE_MAP[key].label}
                    </button>
                ))}
                
                <button onClick={onLogout} style={{ marginTop: '20px', backgroundColor: 'darkred' }}>
                    Sair
                </button>
            </div>

            <div className="main-content">
                {renderActiveComponent()}
            </div>
        </div>
    );
};

export default Dashboard;