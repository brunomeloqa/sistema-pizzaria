import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import PizzariaConfigForm from './PizzariaConfigForm';
import UserManagementAdmin from './UserManagementAdmin';
import PrintConfigForm from './PrintConfigForm';
import PaymentMethodsAdmin from './PaymentMethodsAdmin';
import MesaAdmin from './MesaAdmin';
import PerfilAdmin from './PerfilAdmin';

const ConfigAdmin = () => {
    const [activeTab, setActiveTab] = useState('pizzaria');
    const [config, setConfig] = useState(null); // Inicia como null para saber que está carregando
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const response = await apiService.getConfiguracoes();
            // Garante que os dados existam e print_order seja tratado
            const data = response.data.data || {};
            setConfig(data);
        } catch (error) {
            setMessage('Erro ao carregar configurações.');
            setConfig({}); // Define como objeto vazio para evitar erro de undefined
        }
    };

    const handleConfigChange = (e) => {
        const { name, value, type, checked } = e.target;
        const finalValue = type === 'checkbox' ? (checked ? 1 : 0) : value;
        
        setConfig(prevConfig => ({ 
            ...prevConfig, 
            [name]: finalValue
        }));
    };
    
    const handleSaveConfig = async (e) => {
        if (e) e.preventDefault();
        try {
            await apiService.updateConfiguracoes(config);
            setMessage('Configurações salvas com sucesso!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            setMessage('Erro ao salvar configurações.');
        }
    };

    return (
        <div className="config-container">
            <h2>Configurações do Sistema</h2>
            {message && <div className="alert">{message}</div>}

            <div className="tabs">
                <button className={activeTab === 'pizzaria' ? 'active' : ''} onClick={() => setActiveTab('pizzaria')}>
                    Pizzaria
                </button>
                <button className={activeTab === 'geral' ? 'active' : ''} onClick={() => setActiveTab('geral')}>
                    Geral
                </button>
                <button className={activeTab === 'impressao' ? 'active' : ''} onClick={() => setActiveTab('impressao')}>
                    Impressão
                </button>
                <button className={activeTab === 'payment' ? 'active' : ''} onClick={() => setActiveTab('payment')}>
                    Pagamentos
                </button>
                <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>
                    Usuários
                </button>
                <button className={activeTab === 'perfis' ? 'active' : ''} onClick={() => setActiveTab('perfis')}>
                    Perfis
                </button>
                <button className={activeTab === 'mesas' ? 'active' : ''} onClick={() => setActiveTab('mesas')}>
                    Mesas
                </button>
            </div>

            <div className="tab-content">
                {/* Verificação de segurança: Só renderiza se 'config' não for null */}
                {config ? (
                    <>
                        {activeTab === 'pizzaria' && (
                            <PizzariaConfigForm 
                                config={config}
                                handleConfigChange={handleConfigChange}
                                handleSaveConfig={handleSaveConfig}
                                setMessage={setMessage}
                            />
                        )}

                        {activeTab === 'geral' && (
                            <div style={{ maxWidth: '500px' }}>
                                <h3>Configurações Gerais</h3>

                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
                                        Taxa de Serviço Padrão nas Mesas (%)
                                    </label>
                                    <input
                                        type="number"
                                        name="taxa_servico_padrao"
                                        min="0"
                                        max="100"
                                        step="0.5"
                                        value={config.taxa_servico_padrao ?? 10}
                                        onChange={handleConfigChange}
                                        style={{ padding: '10px', width: '120px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '16px' }}
                                    />
                                    <p style={{ color: '#666', fontSize: '13px', marginTop: '6px' }}>
                                        Percentual aplicado automaticamente ao abrir o fechamento da conta de uma mesa. Pode ser ajustado por conta individualmente.
                                    </p>
                                </div>

                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
                                        Cálculo de Preço em Pizzas com Múltiplos Sabores
                                    </label>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 16px', border: `2px solid ${(config.calculo_pizza ?? 'maior') === 'maior' ? '#e67e22' : '#ddd'}`, borderRadius: '8px', flex: 1 }}>
                                            <input
                                                type="radio"
                                                name="calculo_pizza"
                                                value="maior"
                                                checked={(config.calculo_pizza ?? 'maior') === 'maior'}
                                                onChange={handleConfigChange}
                                            />
                                            <div>
                                                <div style={{ fontWeight: 'bold' }}>Sabor mais caro</div>
                                                <div style={{ fontSize: '12px', color: '#666' }}>Cobra o valor do sabor de maior preço</div>
                                            </div>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 16px', border: `2px solid ${config.calculo_pizza === 'media' ? '#e67e22' : '#ddd'}`, borderRadius: '8px', flex: 1 }}>
                                            <input
                                                type="radio"
                                                name="calculo_pizza"
                                                value="media"
                                                checked={config.calculo_pizza === 'media'}
                                                onChange={handleConfigChange}
                                            />
                                            <div>
                                                <div style={{ fontWeight: 'bold' }}>Média dos sabores</div>
                                                <div style={{ fontSize: '12px', color: '#666' }}>Cobra a média entre os preços dos sabores</div>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <button className="btn-success" onClick={handleSaveConfig} style={{ padding: '12px 30px', fontSize: '15px' }}>
                                    💾 SALVAR CONFIGURAÇÕES
                                </button>

                                {/* SEÇÃO HISTÓRICO DE PEDIDOS */}
                                <hr style={{ margin: '30px 0', borderColor: '#ddd' }} />
                                <h3>🕓 Histórico de Pedidos por Cliente</h3>
                                <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px' }}>
                                    Define quantos pedidos serão exibidos ao consultar o histórico de um cliente na tela de Clientes.
                                </p>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                    {[
                                        { label: 'Últimos 5', value: 5 },
                                        { label: 'Últimos 10', value: 10 },
                                        { label: 'Últimos 15', value: 15 },
                                        { label: 'Últimos 20', value: 20 },
                                        { label: 'Últimos 25', value: 25 },
                                        { label: 'Últimos 30', value: 30 },
                                        { label: 'Todos', value: 0 },
                                    ].map(opt => {
                                        const atual = parseInt(config.historico_pedidos_limite ?? 10);
                                        const selected = atual === opt.value;
                                        return (
                                            <label key={opt.value} style={{
                                                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                                                padding: '8px 14px',
                                                border: `2px solid ${selected ? '#e67e22' : '#ddd'}`,
                                                borderRadius: '8px',
                                                background: selected ? '#fff3e0' : '#fff',
                                                fontWeight: selected ? 'bold' : 'normal',
                                                fontSize: '14px'
                                            }}>
                                                <input
                                                    type="radio"
                                                    name="historico_pedidos_limite"
                                                    value={opt.value}
                                                    checked={selected}
                                                    onChange={handleConfigChange}
                                                    style={{ display: 'none' }}
                                                />
                                                {opt.label}
                                            </label>
                                        );
                                    })}
                                </div>
                                <p style={{ color: '#888', fontSize: '12px', marginBottom: '20px' }}>
                                    Selecione "Todos" para exibir o histórico completo sem limite.
                                </p>

                                {/* SEÇÃO CSV */}
                                <hr style={{ margin: '30px 0', borderColor: '#ddd' }} />
                                <h3>📂 Gestão de Dados (Importação/Exportação)</h3>
                                <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px' }}>
                                    Exporte seus dados para CSV (compatível com Excel) ou importe de um arquivo CSV para atualizar em massa.
                                </p>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                                    {/* CARDÁPIO */}
                                    <div style={{ padding: '16px', border: '1px solid #ddd', borderRadius: '10px', background: '#f8f9fa' }}>
                                        <h4 style={{ margin: '0 0 10px', fontSize: '15px' }}>🍕 Cardápio (Produtos)</h4>
                                        <button 
                                            className="btn-primary" 
                                            onClick={async () => {
                                                try {
                                                    const res = await apiService.exportarProdutosCSV();
                                                    const url = window.URL.createObjectURL(new Blob([res.data]));
                                                    const a = document.createElement('a');
                                                    a.href = url; a.download = 'cardapio.csv'; a.click();
                                                    window.URL.revokeObjectURL(url);
                                                    setMessage('✅ Cardápio exportado com sucesso!');
                                                } catch { setMessage('❌ Erro ao exportar cardápio.'); }
                                            }}
                                            style={{ width: '100%', padding: '10px', marginBottom: '8px', fontSize: '13px' }}
                                        >
                                            📥 Exportar Cardápio (CSV)
                                        </button>
                                        <input 
                                            type="file" accept=".csv" id="importCardapio" style={{ display: 'none' }}
                                            onChange={async (e) => {
                                                const file = e.target.files[0];
                                                if (!file) return;
                                                const formData = new FormData();
                                                formData.append('arquivo', file);
                                                try {
                                                    const res = await apiService.importarProdutosCSV(formData);
                                                    setMessage('✅ ' + (res.data.message || 'Importação concluída!'));
                                                } catch (err) {
                                                    setMessage('❌ ' + (err.response?.data?.error || 'Erro ao importar.'));
                                                }
                                                e.target.value = '';
                                            }}
                                        />
                                        <button 
                                            className="btn-success" 
                                            onClick={() => document.getElementById('importCardapio').click()}
                                            style={{ width: '100%', padding: '10px', fontSize: '13px' }}
                                        >
                                            📤 Importar Cardápio (CSV)
                                        </button>
                                    </div>

                                    {/* CLIENTES */}
                                    <div style={{ padding: '16px', border: '1px solid #ddd', borderRadius: '10px', background: '#f8f9fa' }}>
                                        <h4 style={{ margin: '0 0 10px', fontSize: '15px' }}>👥 Clientes</h4>
                                        <button 
                                            className="btn-primary" 
                                            onClick={async () => {
                                                try {
                                                    const res = await apiService.exportarClientesCSV();
                                                    const url = window.URL.createObjectURL(new Blob([res.data]));
                                                    const a = document.createElement('a');
                                                    a.href = url; a.download = 'clientes.csv'; a.click();
                                                    window.URL.revokeObjectURL(url);
                                                    setMessage('✅ Clientes exportados com sucesso!');
                                                } catch { setMessage('❌ Erro ao exportar clientes.'); }
                                            }}
                                            style={{ width: '100%', padding: '10px', marginBottom: '8px', fontSize: '13px' }}
                                        >
                                            📥 Exportar Clientes (CSV)
                                        </button>
                                        <input 
                                            type="file" accept=".csv" id="importClientes" style={{ display: 'none' }}
                                            onChange={async (e) => {
                                                const file = e.target.files[0];
                                                if (!file) return;
                                                const formData = new FormData();
                                                formData.append('arquivo', file);
                                                try {
                                                    const res = await apiService.importarClientesCSV(formData);
                                                    setMessage('✅ ' + (res.data.message || 'Importação concluída!'));
                                                } catch (err) {
                                                    setMessage('❌ ' + (err.response?.data?.error || 'Erro ao importar.'));
                                                }
                                                e.target.value = '';
                                            }}
                                        />
                                        <button 
                                            className="btn-success" 
                                            onClick={() => document.getElementById('importClientes').click()}
                                            style={{ width: '100%', padding: '10px', fontSize: '13px' }}
                                        >
                                            📤 Importar Clientes (CSV)
                                        </button>
                                    </div>
                                </div>

                                <div style={{ background: '#fff3cd', padding: '12px', borderRadius: '8px', fontSize: '13px', color: '#856404' }}>
                                    <strong>⚠️ Dica:</strong> Para importar, o CSV deve ter cabeçalho com as colunas corretas. 
                                    Exporte primeiro para ver o formato esperado. Se um produto/cliente já existir (mesmo nome ou telefone), ele será atualizado.
                                </div>

                                {/* ZONA DE PERIGO */}
                                <hr style={{ margin: '30px 0', borderColor: '#f5c6cb' }} />
                                <div style={{
                                    border: '2px solid #dc3545',
                                    borderRadius: '10px',
                                    padding: '20px',
                                    background: '#fff5f5'
                                }}>
                                    <h3 style={{ color: '#dc3545', margin: '0 0 8px' }}>🧨 Zona de Perigo</h3>
                                    <p style={{ color: '#721c24', fontSize: '13px', margin: '0 0 16px' }}>
                                        <strong>Atenção:</strong> Esta área contém ações irreversíveis destinadas apenas à fase de testes.
                                        Use com extremo cuidado em ambiente de produção.
                                    </p>

                                    <div style={{
                                        background: '#f8d7da',
                                        border: '1px solid #f5c6cb',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '16px',
                                        flexWrap: 'wrap'
                                    }}>
                                        <div style={{ flex: 1, minWidth: '200px' }}>
                                            <strong style={{ color: '#721c24', display: 'block', marginBottom: '6px' }}>
                                                🗑️ Limpar Banco de Dados
                                            </strong>
                                            <p style={{ color: '#721c24', fontSize: '12px', margin: 0 }}>
                                                Remove <strong>todos</strong> os dados operacionais: clientes, cardápio, entregadores, 
                                                mesas, modos de pagamento, pedidos e todos os históricos.<br />
                                                <strong>Usuários e configurações do sistema serão mantidos.</strong>
                                                <br/>Mesas (01–10) e Modos de Pagamento padrão serão recriados automaticamente.
                                            </p>
                                        </div>
                                        <button
                                            id="btn-limpar-banco"
                                            style={{
                                                background: '#dc3545',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '8px',
                                                padding: '12px 20px',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                                alignSelf: 'center'
                                            }}
                                            onClick={async () => {
                                                const primeira = window.confirm(
                                                    '⚠️ ATENÇÃO!\n\nVocê está prestes a APAGAR TODOS os dados operacionais do sistema:\n\n' +
                                                    '• Clientes\n• Cardápio / Produtos\n• Entregadores\n• Mesas\n• Modos de Pagamento\n• Pedidos\n• Histórico de Pedidos\n• Histórico de Pagamentos\n• Histórico de Caixa\n• Histórico de Pagamentos de Entregadores\n\n' +
                                                    'Usuários e configurações serão MANTIDOS.\n\n' +
                                                    'Deseja continuar?'
                                                );
                                                if (!primeira) return;

                                                const segunda = window.confirm(
                                                    '🔴 CONFIRMAÇÃO FINAL\n\nEssa ação é IRREVERSÍVEL. O banco de dados será limpo agora.\n\nClique em OK para confirmar.'
                                                );
                                                if (!segunda) return;

                                                try {
                                                    const res = await apiService.limparBancoDados();
                                                    setMessage('✅ ' + (res.data.message || 'Banco de dados limpo com sucesso!'));
                                                } catch (err) {
                                                    setMessage('❌ ' + (err.response?.data?.error || 'Erro ao limpar banco de dados.'));
                                                }
                                            }}
                                        >
                                            🗑️ LIMPAR BANCO DE DADOS
                                        </button>
                                    </div>
                                </div>
                            </div>

                        )}

                        {activeTab === 'impressao' && (
                            <PrintConfigForm
                                config={config}
                                handleConfigChange={handleConfigChange}
                                handleSaveConfig={handleSaveConfig}
                            />
                        )}  
                    </>
                ) : (
                    <p>Carregando configurações...</p>
                )}

                {activeTab === 'payment' && <PaymentMethodsAdmin setMessage={setMessage} />}
                {activeTab === 'users' && <UserManagementAdmin setMessage={setMessage} />}
                {activeTab === 'perfis' && <PerfilAdmin setMessage={setMessage} />}
                {activeTab === 'mesas' && <MesaAdmin setMessage={setMessage} />}
            </div>
        </div>
    );
};

export default ConfigAdmin;