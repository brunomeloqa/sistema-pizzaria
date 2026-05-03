import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

const FluxoCaixa = () => {
    // Estados de dados
    const [dadosSaldos, setDadosSaldos] = useState([]);
    const [metodos, setMetodos] = useState([]);
    const [caixaAberto, setCaixaAberto] = useState(false);
    const [relatorio, setRelatorio] = useState({ abertura: 0, itens: [] });
    
    // Estados de UI
    const [form, setForm] = useState({ tipo: 'Suprimento', valor: '', descricao: '', metodo_id: '' });
    const [tipoImpressao, setTipoImpressao] = useState(null); // 'saldo' ou 'completo'
    const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
    const [showModalPedido, setShowModalPedido] = useState(false);
    const [filtroTipoPedido, setFiltroTipoPedido] = useState('Todos');
    const [filtroPagamento, setFiltroPagamento] = useState('Todos');

    const handleOpenPedido = async (id) => {
        try {
            const res = await apiService.buscarPedidoDetalhes(id);
            setPedidoSelecionado(res.data.data);
            setShowModalPedido(true);
        } catch (err) {
            alert("Erro ao buscar detalhes do pedido.");
        }
    };

    const carregarDados = async () => {
        try {
            const resSaldo = await apiService.getSaldoCaixa();
            const listaSaldos = resSaldo.data.data || [];
            setDadosSaldos(listaSaldos);
            
            // Verifica se houve uma abertura (simplificado: se há entradas hoje)
            const temAbertura = listaSaldos.some(item => item.tipo === 'Abertura');
            setCaixaAberto(temAbertura);

            const resMetodos = await apiService.listarModosPagamento();
            setMetodos(Array.isArray(resMetodos.data) ? resMetodos.data : (resMetodos.data?.data || []));

            if (temAbertura) {
                const resRel = await apiService.getRelatorioCaixa();
                setRelatorio(resRel.data);
            }
        } catch (err) {
            console.error("Erro ao carregar caixa:", err);
        }
    };

    useEffect(() => { carregarDados(); }, []);

    const handleMovimentacao = async (e, tipoManual = null) => {
        if(e) e.preventDefault();
        const tipoFinal = tipoManual || form.tipo;
        const valorFinal = parseFloat(form.valor);

        if (!valorFinal || valorFinal <= 0) return alert("Insira um valor válido");

        try {
            await apiService.registrarMovimentacaoCaixa({
                tipo: tipoFinal,
                valor: valorFinal,
                descricao: form.descricao || `Movimentação de ${tipoFinal}`,
                metodo_pagamento_id: form.metodo_id || null
            });
            
            alert(`${tipoFinal} registrado com sucesso!`);
            setForm({ tipo: 'Suprimento', valor: '', descricao: '', metodo_id: '' });
            carregarDados();
        } catch (err) {
            alert("Erro ao registrar movimentação.");
        }
    };

    const prepararImpressao = async (tipo) => {
        try {
            const res = await apiService.getRelatorioCaixa();
            setRelatorio(res.data);
            
            // Envia para a impressora térmica do servidor
            await apiService.imprimirRelatorioCaixa({
                tipoImpressao: tipo,
                relatorio: res.data
            });
            alert("Comando de impressão enviado para a impressora!");
        } catch (err) {
            console.error("Erro na impressão do caixa:", err);
            alert("Erro ao enviar comando de impressão para o servidor.");
        }
    };

    // Cálculos de exibição
    const getSaldoPorMetodo = (metodoNome) => {
        return dadosSaldos
            .filter(item => item.metodo_nome === metodoNome || (metodoNome === 'Dinheiro' && item.metodo_nome === 'Dinheiro/Geral'))
            .reduce((acc, item) => {
                if (['Entrada', 'Suprimento', 'Abertura'].includes(item.tipo)) return acc + item.total;
                if (['Sangria', 'Saída'].includes(item.tipo)) return acc - item.total;
                return acc;
            }, 0);
    };

    const getSaldoLiquidoDoDia = () => {
        return dadosSaldos
            .filter(item => typeof item.metodo_nome === 'string' && item.metodo_nome.toLowerCase() !== 'cupom')
            .reduce((acc, item) => {
                // Ignora "Abertura" no saldo líquido faturado do dia
                if (['Entrada', 'Suprimento'].includes(item.tipo)) return acc + item.total;
                if (['Sangria', 'Saída'].includes(item.tipo)) return acc - item.total;
                return acc;
            }, 0);
    };

    const extrairTroco = (obs) => {
        if(!obs) return '--';
        const match = obs.match(/(Troco para R\$.*?\(Enviar R\$.*?\))/);
        return match ? match[1] : '--';
    };

    const handleEncerrarExpediente = async () => {
        const confirmar = window.confirm(
            "ATENÇÃO: Isso irá zerar o saldo atual e arquivar todas as movimentações no histórico. Deseja continuar?"
        );

        if (!confirmar) return;

        try {
            // 1. Primeiro imprime o relatório completo automaticamente para segurança
            await prepararImpressao('completo');

            // 2. Chama a API para limpar/arquivar
            await apiService.postFecharCaixa();

            alert("Caixa encerrado com sucesso! O sistema está pronto para uma nova abertura.");

            // 3. Reseta o estado para mostrar a tela de "Caixa Fechado"
            setCaixaAberto(false);
            setDadosSaldos([]);
            carregarDados();
        } catch (err) {
            console.error(err);
            alert("Erro ao encerrar o caixa.");
        }
    };

    const totaisRelatorio = relatorio.itens.reduce((acc, item) => {
        if (!acc[item.metodo]) acc[item.metodo] = 0;
        if (['Entrada', 'Suprimento', 'Abertura'].includes(item.tipo)) acc[item.metodo] += item.valor;
        if (['Sangria', 'Saída'].includes(item.tipo)) acc[item.metodo] -= item.valor;
        return acc;
    }, {});

    const itensFiltrados = relatorio.itens.filter(item => {
        let okTipo = true;
        let okPag = true;
        
        if (filtroTipoPedido !== 'Todos') {
            if (filtroTipoPedido === 'Avulso') {
                okTipo = !item.pedido_id;
            } else {
                okTipo = item.pedido_tipo === filtroTipoPedido;
            }
        }
        if (filtroPagamento !== 'Todos') {
            okPag = item.metodo === filtroPagamento;
        }
        return okTipo && okPag;
    });

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <style>
                {`
                .print-zone { display: none; }
                @media print {
                    body * { visibility: hidden; }
                    .print-zone, .print-zone * { visibility: visible; }
                    .print-zone { display: block; position: absolute; left: 0; top: 0; width: 75mm; font-family: 'Courier New', monospace; font-size: 10pt; color: #000; }
                    .no-print { display: none !important; }
                    .divider { border-bottom: 1px dashed #000; margin: 5px 0; }
                }
                `}
            </style>

            <h2 className="no-print">💰 Gestão de Fluxo de Caixa</h2>

            {!caixaAberto ? (
                /* TELA DE ABERTURA */
                <div style={styles.aberturaContainer} className="no-print">
                    <h3>Caixa Fechado</h3>
                    <p>Informe o valor de fundo de reserva (troco) para iniciar o dia.</p>
                    <input 
                        type="number" 
                        placeholder="Valor Inicial R$ 0,00" 
                        value={form.valor} 
                        onChange={e => setForm({...form, valor: e.target.value})}
                        style={styles.inputGrande}
                    />
                    <button onClick={() => handleMovimentacao(null, 'Abertura')} style={styles.btnAbrir}>ABRIR CAIXA</button>
                </div>
            ) : (
                /* DASHBOARD DO CAIXA ABERTO */
                <div className="no-print">
                    <div style={styles.gridCards}>
                        <div style={{ ...styles.card, borderLeft: '8px solid #28a745' }}>
                            <small>DINHEIRO EM CAIXA</small>
                            <h2>R$ {getSaldoPorMetodo('Dinheiro').toFixed(2)}</h2>
                        </div>
                        <div style={{ ...styles.card, borderLeft: '8px solid #17a2b8' }}>
                            <small>SALDO DO DIA (LÍQUIDO)</small>
                            <h2>R$ {getSaldoLiquidoDoDia().toFixed(2)}</h2>
                        </div>
                        {metodos.map(m => (
                            <div key={m.id} style={{ ...styles.card, borderLeft: '8px solid #007bff' }}>
                                <small>{m.nome.toUpperCase()}</small>
                                <h2>R$ {getSaldoPorMetodo(m.nome).toFixed(2)}</h2>
                            </div>
                        ))}
                    </div>

                    <div style={styles.formContainer}>
                        <h4>Suprimento / Sangria Manual</h4>
                        <form onSubmit={handleMovimentacao} style={styles.formLine}>
                            <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} style={styles.input}>
                                <option value="Suprimento">Suprimento (+ Entrou)</option>
                                <option value="Sangria">Sangria (- Retirou)</option>
                            </select>
                            <input type="number" step="0.01" placeholder="Valor R$" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} style={styles.input} />
                            <input type="text" placeholder="Motivo/Descrição" value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} style={{ ...styles.input, flex: 2 }} />
                            <button type="submit" style={styles.btnAcao}>REGISTRAR</button>
                        </form>
                    </div>

                    <div style={styles.tabelaContainer}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h4 style={{ margin: 0 }}>Histórico de Movimentações Atuais</h4>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <select value={filtroTipoPedido} onChange={e => setFiltroTipoPedido(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}>
                                    <option value="Todos">Todos os Tipos</option>
                                    <option value="Balcão">Balcão</option>
                                    <option value="Delivery">Delivery</option>
                                    <option value="Mesa">Mesa</option>
                                    <option value="Retirada">Retirada</option>
                                    <option value="Avulso">Caixa Avulso</option>
                                </select>
                                <select value={filtroPagamento} onChange={e => setFiltroPagamento(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}>
                                    <option value="Todos">Todos Pagamentos</option>
                                    {metodos.map(m => (
                                        <option key={m.id} value={m.nome}>{m.nome}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{ maxHeight: '350px', overflowY: 'auto', background: '#fff', padding: '10px', borderRadius: '5px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #ddd' }}>
                                        <th style={{ padding: '8px' }}>Hora</th>
                                        <th style={{ padding: '8px' }}>Tipo</th>
                                        <th style={{ padding: '8px' }}>Descrição</th>
                                        <th style={{ padding: '8px' }}>Cliente / Entregador</th>
                                        <th style={{ padding: '8px' }}>Obs / Troco</th>
                                        <th style={{ padding: '8px' }}>Método</th>
                                        <th style={{ padding: '8px', textAlign: 'right' }}>Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {itensFiltrados.map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                            <td style={{ padding: '8px', color: '#555' }}>
                                                {new Date(item.data_movimentacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                <span style={{ 
                                                    background: ['Entrada', 'Suprimento', 'Abertura'].includes(item.tipo) ? '#d4edda' : '#f8d7da', 
                                                    color: ['Entrada', 'Suprimento', 'Abertura'].includes(item.tipo) ? '#155724' : '#721c24',
                                                    padding: '2px 6px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold'
                                                }}>
                                                    {item.tipo}
                                                </span>
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                {item.descricao.includes('Pedido #') ? (
                                                    <span>
                                                        {item.descricao.split(/(Pedido #\d+)/).map((part, i) => {
                                                            const match = part.match(/Pedido #(\d+)/);
                                                            if (match) {
                                                                return (
                                                                    <a key={i} href="#" onClick={(e) => { e.preventDefault(); handleOpenPedido(match[1]); }} style={{color: '#007bff', textDecoration: 'underline'}}>
                                                                        {part}
                                                                    </a>
                                                                );
                                                            }
                                                            return <span key={i}>{part}</span>;
                                                        })}
                                                    </span>
                                                ) : (
                                                    item.descricao
                                                )}
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                {item.cliente_nome ? (
                                                    <div style={{ fontWeight: 'bold' }}>{item.cliente_nome}</div>
                                                ) : <span style={{ color: '#ccc' }}>--</span>}
                                                {item.entregador_nome && (
                                                    <div style={{ fontSize: '11px', color: '#e67e22' }}>🛵 {item.entregador_nome}</div>
                                                )}
                                            </td>
                                            <td style={{ padding: '8px', color: '#856404', fontSize: '12px' }}>
                                                {item.observacao_pedido && item.observacao_pedido.replace(/(Troco para R\$.*?\(Enviar R\$.*?\))/g, '').replace(/\|\s*$/, '').trim()}
                                                {extrairTroco(item.observacao_pedido) !== '--' && (
                                                    <div style={{ fontWeight: 'bold', color: '#d35400', marginTop: '4px' }}>
                                                        {extrairTroco(item.observacao_pedido)}
                                                    </div>
                                                )}
                                                {!item.observacao_pedido && '--'}
                                            </td>
                                            <td style={{ padding: '8px' }}>{item.metodo}</td>
                                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: ['Entrada', 'Suprimento', 'Abertura'].includes(item.tipo) ? '#28a745' : '#dc3545' }}>
                                                {['Entrada', 'Suprimento', 'Abertura'].includes(item.tipo) ? '+' : '-'} R$ {item.valor.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                    {itensFiltrados.length === 0 && (
                                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '15px' }}>Nenhuma movimentação para estes filtros.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={styles.footerAcoes}>
                        <button onClick={() => prepararImpressao('saldo')} style={styles.btnSecundario}>🖨️ IMPRIMIR SALDO</button>
                        <button onClick={() => prepararImpressao('completo')} style={styles.btnSecundario}>📜 RELATÓRIO DETALHADO</button>
                        <button onClick={() => handleEncerrarExpediente()} style={styles.btnFechar}>🔒 ENCERRAR EXPEDIENTE</button>
                    </div>
                </div>
            )}

            {/* ZONA DE IMPRESSÃO (OCULTA NA TELA) */}
            <div className="print-zone">
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ margin: 0 }}>SISTEMA RESTAURANTE</h2>
                    <p style={{ margin: 5 }}>Relatório de Movimentação</p>
                    <p style={{ fontSize: '8pt' }}>Emissão: {new Date().toLocaleString()}</p>
                </div>
                
                <div className="divider"></div>
                <p><strong>ABERTURA:</strong> R$ {relatorio.abertura.toFixed(2)}</p>
                <div className="divider"></div>

                {tipoImpressao === 'saldo' ? (
                    <div>
                        <p style={{ textAlign: 'center' }}><strong>RESUMO DE SALDOS</strong></p>
                        {Object.keys(totaisRelatorio).map(m => (
                            <div key={m} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>{m}:</span>
                                <span>R$ {totaisRelatorio[m].toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div>
                        <p style={{ textAlign: 'center' }}><strong>LISTAGEM DETALHADA</strong></p>
                        {itensFiltrados.map((item, i) => (
                            <div key={i} style={{ marginBottom: 5, fontSize: '9pt', paddingBottom: '4px', borderBottom: '1px dashed #eee' }}>
                                <div>
                                    {new Date(item.data_movimentacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {item.tipo}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{item.descricao.substring(0, 20)}</span>
                                    <span>R$ {item.valor.toFixed(2)}</span>
                                </div>
                                {(item.cliente_nome || item.entregador_nome || item.observacao_pedido) && (
                                    <div style={{ fontSize: '8pt', color: '#555', paddingLeft: '10px' }}>
                                        {item.cliente_nome && <span>Cli: {item.cliente_nome} </span>}
                                        {item.entregador_nome && <span>| Entreg: {item.entregador_nome} </span>}
                                        {item.observacao_pedido && <span>| Obs: {item.observacao_pedido}</span>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="divider" style={{ marginTop: 15 }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>TOTAL LÍQUIDO:</span>
                    <span>R$ {Object.values(totaisRelatorio).reduce((a, b) => a + b, 0).toFixed(2)}</span>
                </div>
                <div className="divider"></div>
                <br /><br />
                <div style={{ textAlign: 'center' }}>
                    <span>___________________________</span><br />
                    <span>Assinatura do Gerente</span>
                </div>
            </div>

            {/* MODAL DETALHE DO PEDIDO */}
            {showModalPedido && pedidoSelecionado && (
                <div onClick={() => setShowModalPedido(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} className="no-print">
                    <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', padding: '20px', borderRadius: '10px', width: '90%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: '10px', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0 }}>Detalhes do Pedido #{pedidoSelecionado.id}</h3>
                            <button onClick={() => setShowModalPedido(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✖</button>
                        </div>
                        
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            
                            {/* Dados do Cliente (expandido se for Delivery) */}
                            {pedidoSelecionado.cliente_nome ? (
                                <div style={{ background: '#f0f7ff', border: '1px solid #cce5ff', borderRadius: '8px', padding: '12px', marginBottom: '15px' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '8px', color: '#004085' }}>👤 Dados do Cliente</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '14px' }}>
                                        <div><strong>Nome:</strong> {pedidoSelecionado.cliente_nome}</div>
                                        {pedidoSelecionado.cliente_telefone && <div><strong>Telefone:</strong> {pedidoSelecionado.cliente_telefone}</div>}
                                        {pedidoSelecionado.cliente_celular && <div><strong>Celular:</strong> {pedidoSelecionado.cliente_celular}</div>}
                                        {pedidoSelecionado.cliente_bairro && <div><strong>Bairro:</strong> {pedidoSelecionado.cliente_bairro}</div>}
                                    </div>
                                    {/* Endereço completo */}
                                    {(pedidoSelecionado.endereco_entrega || pedidoSelecionado.cliente_endereco) && (
                                        <div style={{ marginTop: '8px', fontSize: '14px' }}>
                                            <strong>📍 Endereço:</strong>{' '}
                                            {pedidoSelecionado.endereco_entrega || pedidoSelecionado.cliente_endereco}
                                            {pedidoSelecionado.cliente_numero ? `, nº ${pedidoSelecionado.cliente_numero}` : ''}
                                            {pedidoSelecionado.complemento_entrega ? ` — ${pedidoSelecionado.complemento_entrega}` : (pedidoSelecionado.cliente_complemento ? ` — ${pedidoSelecionado.cliente_complemento}` : '')}
                                        </div>
                                    )}
                                    {/* Observação do cadastro do cliente */}
                                    {pedidoSelecionado.cliente_observacao && (
                                        <div style={{ marginTop: '8px', fontSize: '13px', color: '#856404', background: '#fff3cd', padding: '6px', borderRadius: '4px' }}>
                                            <strong>📝 Obs. Cliente:</strong> {pedidoSelecionado.cliente_observacao}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p><strong>Cliente / Destino:</strong> {pedidoSelecionado.mesa_id ? `Mesa ${pedidoSelecionado.mesa_id}` : pedidoSelecionado.tipo || 'Balcão'}</p>
                            )}
                            
                            {/* Observação do Pedido */}
                            {pedidoSelecionado.observacao && (
                                <div style={{ background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '6px', padding: '10px', marginBottom: '15px' }}>
                                    <strong>⚠️ Observação do Pedido:</strong> {pedidoSelecionado.observacao}
                                </div>
                            )}

                            <p style={{ margin: '5px 0 10px' }}><strong>Data:</strong> {new Date(pedidoSelecionado.data_hora).toLocaleString('pt-BR')} &nbsp;|&nbsp; <strong>Status:</strong> {pedidoSelecionado.status}</p>

                            <h4>Itens</h4>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
                                <thead>
                                    <tr style={{ background: '#f5f5f5' }}>
                                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Item</th>
                                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Qtd</th>
                                        <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pedidoSelecionado.itens && pedidoSelecionado.itens.map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '8px' }}>
                                                {item.nome}
                                                {item.observacao && <span style={{fontSize: '12px', color: '#666'}}><br/><small><i>obs: {item.observacao}</i></small></span>}
                                            </td>
                                            <td style={{ padding: '8px', textAlign: 'center' }}>{item.quantidade}</td>
                                            <td style={{ padding: '8px', textAlign: 'right' }}>R$ {(item.valor * item.quantidade).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', flexDirection: 'column', alignItems: 'flex-end', fontSize: '16px', marginBottom: '15px' }}>
                                {pedidoSelecionado.desconto > 0 && <p style={{ margin: '5px 0' }}>Desconto: - R$ {pedidoSelecionado.desconto.toFixed(2)}</p>}
                                <p style={{ margin: '5px 0', fontWeight: 'bold', fontSize: '18px' }}>Total Calculado: R$ {pedidoSelecionado.valor_total.toFixed(2)}</p>
                            </div>

                            <h4>Formas de Pagamento Registradas</h4>
                            <ul style={{ paddingLeft: '20px' }}>
                                {pedidoSelecionado.pagamentos && pedidoSelecionado.pagamentos.length > 0 ? (
                                    pedidoSelecionado.pagamentos.map((pg, idx) => (
                                        <li key={idx}>{pg.metodo_nome}: R$ {pg.valor.toFixed(2)}</li>
                                    ))
                                ) : (
                                    <li>Padrão: {pedidoSelecionado.modo_pagamento_nome || 'Não Registrado'}</li>
                                )}
                            </ul>
                        </div>
                        
                        <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px', textAlign: 'right' }}>
                            <button onClick={() => setShowModalPedido(false)} style={{ background: '#dc3545', color: '#fff', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                                FECHAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    gridCards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' },
    card: { background: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    tabelaContainer: { background: '#eee', padding: '20px', borderRadius: '10px', marginBottom: '20px' },
    aberturaContainer: { textAlign: 'center', padding: '50px', background: '#f8f9fa', borderRadius: '15px', border: '2px dashed #ccc' },
    inputGrande: { padding: '15px', fontSize: '20px', width: '250px', textAlign: 'center', marginBottom: '20px', display: 'block', margin: '20px auto' },
    btnAbrir: { background: '#28a745', color: '#fff', padding: '15px 40px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' },
    formContainer: { background: '#eee', padding: '20px', borderRadius: '10px', marginBottom: '20px' },
    formLine: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    input: { padding: '10px', borderRadius: '5px', border: '1px solid #ccc' },
    btnAcao: { background: '#333', color: '#fff', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer' },
    footerAcoes: { display: 'flex', gap: '10px', marginTop: '30px' },
    btnSecundario: { background: '#6c757d', color: '#fff', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', flex: 1 },
    btnFechar: { background: '#dc3545', color: '#fff', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', flex: 1, fontWeight: 'bold' }
};

export default FluxoCaixa;