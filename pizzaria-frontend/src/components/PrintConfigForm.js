import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { BACKEND_BASE_URL } from '../constants/apiConstants';

const PrintConfigForm = ({ config = {}, handleConfigChange, handleSaveConfig }) => {
    const [subTab, setSubTab] = useState('geral');
    const [printersList, setPrintersList] = useState([]);

    useEffect(() => {
        // Busca a lista de impressoras disponíveis
        const fetchPrinters = async () => {
            try {
                const response = await apiService.api.get('/config/printers');
                if (response.data && response.data.printers) {
                    setPrintersList(response.data.printers);
                }
            } catch (error) {
                console.error("Erro ao buscar lista de impressoras:", error);
            }
        };

        if (subTab === 'geral') {
            fetchPrinters();
        }
    }, [subTab]);
    
    // Lista completa de todos os itens disponíveis (usado em qualquer layout)
    const availableItems = [
        { id: 'num_pedido', label: 'Número do Pedido' },
        { id: 'dados_cliente', label: 'Dados do Cliente (Nome, Tel, Endereço)' },
        { id: 'itens_pedido', label: 'Itens do Pedido (Qtde, Nome, Valores)' },
        { id: 'valor_total', label: 'Valor Total' },
        { id: 'modo_pagamento', label: 'Forma de Pagamento' },
        { id: 'observacao', label: 'Observação Geral do Pedido' },
    ];

    const getOrderArray = (fieldStr) => {
        let savedList = [];
        if (!fieldStr || (typeof fieldStr === 'string' && fieldStr.trim() === '')) {
            savedList = availableItems.map(i => i.id);
        } else if (typeof fieldStr === 'string') {
            savedList = fieldStr.split(',');
        } else if (Array.isArray(fieldStr)) {
            savedList = fieldStr.length > 0 ? fieldStr : availableItems.map(i => i.id);
        }

        // Garante que TODOS os disponíveis estejam na lista final (anexando no fim se faltar)
        availableItems.forEach(item => {
            if (!savedList.includes(item.id)) {
                savedList.push(item.id);
            }
        });

        // Remove sujeiras (ids salvos no banco que não existem mais)
        return savedList.filter(id => availableItems.some(i => i.id === id));
    };

    const currentOrderCozinha = getOrderArray(config.print_order_cozinha);
    const currentOrderEntrega = getOrderArray(config.print_order_entregador);

    const moveItem = (listName, currentOrderArray, index, direction) => {
        const newOrder = [...currentOrderArray];
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= newOrder.length) return;
        
        [newOrder[index], newOrder[nextIndex]] = [newOrder[nextIndex], newOrder[index]];
        handleConfigChange({ 
            target: { name: listName, value: newOrder.join(',') } 
        });
    };

    const handleTestPrint = async (layoutType) => {
        try {
            const data = { layoutType };
            const response = await apiService.api.post('/config/test-print', data);
            
            if (response.data) {
                alert(`Comando de teste (${layoutType}) enviado com sucesso!`);
            }
        } catch (error) {
            console.error("Erro ao testar impressão:", error);
            alert('Falha ao enviar comando para a impressora. Verifique o servidor/caminho.');
        }
    };

    // Estilos p/ Abas Internas
    const navStyle = {
        display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #ddd', paddingBottom: '10px'
    };
    const tabBtnStyle = (isActive) => ({
        padding: '10px 20px', cursor: 'pointer', border: 'none', background: isActive ? '#007bff' : '#f1f1f1', 
        color: isActive ? '#fff' : '#333', borderRadius: '4px', fontWeight: 'bold'
    });

    return (
        <div>
            <div style={navStyle}>
                <button type="button" onClick={() => setSubTab('geral')} style={tabBtnStyle(subTab === 'geral')}>Geral (Conexão)</button>
                <button type="button" onClick={() => setSubTab('cozinha')} style={tabBtnStyle(subTab === 'cozinha')}>Layout Cozinha</button>
                <button type="button" onClick={() => setSubTab('entrega')} style={tabBtnStyle(subTab === 'entrega')}>Layout Entrega (Cliente)</button>
            </div>

            <div style={{ display: 'flex', gap: '30px', padding: '10px' }}>
                <div style={{ flex: 1 }}>
                    {/* ABA GERAL */}
                    {subTab === 'geral' && (
                        <div>
                            <h3>Configuração Física da Impressora</h3>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Tipo de Conexão</label>
                                <select name="impressora_tipo" value={config.impressora_tipo || 'windows_share'} onChange={handleConfigChange} style={{ padding: '10px', width: '100%', borderRadius: '4px', border: '1px solid #ccc' }}>
                                    <option value="serial">Porta Serial / LPT / Driver Cru</option>
                                    <option value="windows_share">Impressora Windows (Rede/Compartilhada)</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Caminho ou Nome do Compartilhamento</label>
                                <select 
                                    name="impressora_caminho" 
                                    value={config.impressora_caminho || ''} 
                                    onChange={handleConfigChange} 
                                    style={{ padding: '10px', width: '100%', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '10px' }} 
                                >
                                    <option value="" disabled>Selecione nas impressoras identificadas...</option>
                                    {printersList.map((printerName, i) => (
                                        <option key={i} value={printerName}>{printerName}</option>
                                    ))}
                                    {config.impressora_caminho && !printersList.includes(config.impressora_caminho) && (
                                        <option value={config.impressora_caminho}>{config.impressora_caminho} (Caminho Customizado)</option>
                                    )}
                                </select>
                                
                                <input 
                                    type="text" 
                                    name="impressora_caminho" 
                                    value={config.impressora_caminho || ''} 
                                    onChange={handleConfigChange} 
                                    placeholder="Ou digite manualmente (Ex: COM1 ou \\localhost\Diebold)" 
                                    style={{ padding: '10px', width: '100%', borderRadius: '4px', border: '1px solid #ccc' }} 
                                />
                            </div>

                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Tamanho da Fonte</label>
                                <select name="print_font_size" value={config.print_font_size || 'Normal'} onChange={handleConfigChange} style={{ padding: '10px', width: '100%', borderRadius: '4px', border: '1px solid #ccc' }}>
                                    <option value="Normal">Normal</option>
                                    <option value="Expandida">Expandida (Dupla Larg/Alt)</option>
                                </select>
                            </div>

                            <div style={{ marginTop: '30px' }}>
                                <button onClick={handleSaveConfig} className="btn-success" style={{ padding: '12px 25px' }}>💾 Salvar Conexão</button>
                            </div>
                        </div>
                    )}

                    {/* ABA COZINHA */}
                    {subTab === 'cozinha' && (
                        <div>
                            <h3>Prioridade de Itens - Cozinha</h3>
                            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {currentOrderCozinha.map((itemId, index) => {
                                    const item = availableItems.find(i => i.id === itemId);
                                    if (!item) return null;
                                    const isEnabled = config[`show_${itemId}`] !== 0;

                                    return (
                                        <div key={itemId} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', background: isEnabled ? '#fff' : '#f5f5f5' }}>
                                            <div style={{ display: 'flex', gap: '5px', marginRight: '15px' }}>
                                                <button type="button" onClick={() => moveItem('print_order_cozinha', currentOrderCozinha, index, -1)}>↑</button>
                                                <button type="button" onClick={() => moveItem('print_order_cozinha', currentOrderCozinha, index, 1)}>↓</button>
                                            </div>
                                            <span style={{ flex: 1, fontWeight: isEnabled ? 'bold' : 'normal', color: isEnabled ? '#333' : '#999' }}>{item.label}</span>
                                            <input type="checkbox" name={`show_${itemId}`} checked={isEnabled} onChange={handleConfigChange} />
                                        </div>
                                    );
                                })}
                            </div>

                            <button onClick={handleSaveConfig} className="btn-success" style={{ padding: '10px 20px', marginRight: '10px' }}>Salvar Layout Cozinha</button>
                            <button onClick={() => handleTestPrint('cozinha')} className="btn-primary" style={{ padding: '10px 20px' }}>Imprimir Teste (Cozinha)</button>
                        </div>
                    )}

                    {/* ABA ENTREGA */}
                    {subTab === 'entrega' && (
                        <div>
                            <h3>Prioridade de Itens - Entrega / Cliente</h3>
                            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {currentOrderEntrega.map((itemId, index) => {
                                    const item = availableItems.find(i => i.id === itemId);
                                    if (!item) return null;
                                    const isEnabled = config[`show_${itemId}`] !== 0;

                                    return (
                                        <div key={itemId} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', background: isEnabled ? '#fff' : '#f5f5f5' }}>
                                            <div style={{ display: 'flex', gap: '5px', marginRight: '15px' }}>
                                                <button type="button" onClick={() => moveItem('print_order_entregador', currentOrderEntrega, index, -1)}>↑</button>
                                                <button type="button" onClick={() => moveItem('print_order_entregador', currentOrderEntrega, index, 1)}>↓</button>
                                            </div>
                                            <span style={{ flex: 1, fontWeight: isEnabled ? 'bold' : 'normal', color: isEnabled ? '#333' : '#999' }}>{item.label}</span>
                                            <input type="checkbox" name={`show_${itemId}`} checked={isEnabled} onChange={handleConfigChange} />
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{ marginTop: '20px' }}>
                                <h4>Mensagem de Rodapé</h4>
                                <textarea name="footer_message" value={config.footer_message || ''} onChange={handleConfigChange} placeholder="Ex: Obrigado pela preferência! Volte sempre." style={{ width: '100%', height: '80px', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
                            </div>

                            <br/>
                            <button onClick={handleSaveConfig} className="btn-success" style={{ padding: '10px 20px', marginRight: '10px' }}>Salvar Layout Entrega</button>
                            <button onClick={() => handleTestPrint('entregador')} className="btn-primary" style={{ padding: '10px 20px' }}>Imprimir Teste (Entrega)</button>
                        </div>
                    )}
                </div>

                {/* Coluna de Preview Visual */}
                {(subTab === 'cozinha' || subTab === 'entrega') && (
                    <div style={{ width: '320px' }}>
                        <h4 style={{ textAlign: 'center' }}>Preview Visual Simulado</h4>
                        <div style={{ 
                            background: '#fff', padding: '10px', border: '1px solid #000',
                            fontFamily: 'monospace', fontSize: config.print_font_size === 'Expandida' ? '18px' : '13px',
                            color: '#000', minHeight: '400px', boxShadow: '5px 5px 15px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
                                {config.logo_url && subTab === 'entrega' && (
                                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                                        <img src={`${BACKEND_BASE_URL}${config.logo_url}`} alt="Logo" style={{ width: '60px', objectFit: 'contain' }} />
                                    </div>
                                )}
                                <strong>{config.nome_pizzaria || 'NOME DA PIZZARIA'}</strong><br/>
                            </div>

                            {(subTab === 'cozinha' ? currentOrderCozinha : currentOrderEntrega).map(itemId => {
                                if (config[`show_${itemId}`] === 0) return null;
                                
                                switch(itemId) {
                                    case 'num_pedido': return <div key={itemId} style={{ padding: '5px 0', textAlign: 'center', fontSize: '1.2em', fontWeight: 'bold' }}>PEDIDO #001</div>;
                                    case 'dados_cliente': return <div key={itemId} style={{ padding: '5px 0' }}>CLIENTE: Maria<br/>TEL: (11) 99999-9999<br/>END: Rua Exemplo</div>;
                                    case 'itens_pedido': return (
                                        <div key={itemId} style={{ padding: '5px 0', borderTop: '1px solid #eee', borderBottom: '1px solid #eee' }}>
                                            1x Pizza Calabresa<br/> {subTab !== 'cozinha' ? '   un. R$ 50,00' : ''}
                                        </div>
                                    );
                                    case 'valor_total': return <div key={itemId} style={{ textAlign: 'right', fontWeight: 'bold', paddingTop: '5px' }}>TOTAL: R$ 50,00</div>;
                                    case 'modo_pagamento': return <div key={itemId} style={{ textAlign: 'right' }}>PAGTO: Pix</div>;
                                    case 'observacao': return <div key={itemId} style={{ fontStyle: 'italic', marginTop: '5px' }}>OBS: Sem cebola!</div>;
                                    default: return null;
                                }
                            })}

                            <div style={{ marginTop: '20px', paddingTop: '10px', borderTop: '1px dashed #000', textAlign: 'center', whiteSpace: 'pre-wrap' }}>
                                {subTab === 'entrega' ? (config.footer_message || '') : ''}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PrintConfigForm;