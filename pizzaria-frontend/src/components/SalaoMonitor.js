import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import PedidoModulo from './shared/PedidoModulo';
import MultiPagamento from './shared/MultiPagamento';
import { agruparItens, formatarMoeda } from '../utils/helpers';

const STATUS_BADGE = {
    'Pendente':                     { bg: '#fff3cd', cor: '#856404', label: '⏳ Pendente' },
    'Preparando':                   { bg: '#cce5ff', cor: '#004085', label: '👨‍🍳 Preparando' },
    'Pronto para Entrega/Retirada': { bg: '#d4edda', cor: '#155724', label: '✅ Pronto' },
    'Servido':                      { bg: '#e2e3e5', cor: '#383d41', label: '🍽️ Servido' },
};

const SalaoMonitor = () => {
    const [mesasStatus, setMesasStatus]       = useState([]);
    const [mesaDetalhe, setMesaDetalhe]       = useState(null);
    const [taxaServico, setTaxaServico]       = useState(10);
    const [taxaPadrao, setTaxaPadrao]         = useState(10);
    const [carrinho, setCarrinho]             = useState([]);
    const [metodosPagamento, setMetodosPagamento] = useState([]);
    const [pagamentos, setPagamentos] = useState([]);
    const [showPagamento, setShowPagamento]   = useState(false);
    const [descontoValor, setDescontoValor]   = useState(0);
    const [descontoPorcentagem, setDescontoPorcentagem] = useState(0);
    const [quantidadePessoas, setQuantidadePessoas] = useState(1);
    const [observacaoPedido, setObservacaoPedido] = useState('');
    const [mensagem, setMensagem]             = useState('');

    const mostrarMensagem = (msg) => {
        setMensagem(msg);
        setTimeout(() => setMensagem(''), 3000);
    };

    const carregarDados = async () => {
        try {
            const res = await apiService.getStatusSalao();
            const mesas = res.data.data || [];
            setMesasStatus(mesas);
            if (mesaDetalhe) {
                const atualizada = mesas.find(m => m.id === mesaDetalhe.id);
                if (atualizada) setMesaDetalhe(atualizada);
            }
        } catch (err) {
            console.error('Erro ao carregar mesas:', err);
        }
    };

    useEffect(() => {
        carregarDados();
        apiService.listarModosPagamento().then(res => setMetodosPagamento(res.data.data || res.data || []));
        apiService.getConfiguracoes().then(res => {
            const t = res.data?.data?.taxa_servico_padrao;
            if (t !== undefined && t !== null) {
                setTaxaPadrao(Number(t));
                setTaxaServico(Number(t));
            }
        }).catch(() => {});
        const interval = setInterval(carregarDados, 5000);
        return () => clearInterval(interval);
    }, [mesaDetalhe?.id]);

    // ── ABRIR CONTA ──────────────────────────────────────────────────────
    const handleAbrirConta = async () => {
        try {
            await apiService.abrirContaMesa({ mesa_id: mesaDetalhe.id });
            carregarDados();
        } catch (err) {
            alert('Erro ao abrir conta.');
        }
    };

    // ── CARRINHO ─────────────────────────────────────────────────────────
    const adicionarAoCarrinho = (item) => {
        setCarrinho(prev => [...prev, { ...item, quantidade: item.quantidade || 1 }]);
        mostrarMensagem(`${item.nome} adicionado ao carrinho!`);
    };

    const removerDoCarrinho = (idx) => {
        setCarrinho(prev => prev.filter((_, i) => i !== idx));
    };

    // ── ENVIAR PARA COZINHA ───────────────────────────────────────────────
    const handleEnviarParaCozinha = async () => {
        if (carrinho.length === 0) return alert('O carrinho está vazio.');
        try {
            const itens = carrinho.map(item => ({
                produto_id: typeof item.id === 'number' ? item.id : null,
                nome: item.nome,
                valor: item.preco,
                quantidade: item.quantidade || 1,
                observacao: item.observacao || null,
            }));
            await apiService.criarPedido({
                mesa_id: mesaDetalhe.id,
                parent_id: mesaDetalhe.pedido_id,
                itens,
                observacao: observacaoPedido || null,
                valor_total: carrinho.reduce((s, i) => s + (i.preco * (i.quantidade || 1)), 0),
            });
            setCarrinho([]);
            setObservacaoPedido('');
            mostrarMensagem('✅ Pedido enviado para a cozinha!');
            carregarDados();
        } catch (err) {
            alert('Erro ao enviar pedido para a cozinha.');
            console.error(err);
        }
    };

    // ── FECHAR CONTA MESA VAZIA ───────────────────────────────────────────
    const handleCancelarMesaVazia = async () => {
        if (!window.confirm(`Tem certeza que deseja cancelar/liberar a Mesa ${mesaDetalhe.numero}?`)) return;
        try {
            await apiService.atualizarStatusPedido(mesaDetalhe.pedido_id, 'Cancelado');
            setMesaDetalhe(null);
            setCarrinho([]);
            mostrarMensagem(`✅ Mesa ${mesaDetalhe.numero} liberada com sucesso.`);
            carregarDados();
        } catch (err) {
            alert('Erro ao liberar a mesa.');
        }
    };

    // ── FECHAR CONTA ──────────────────────────────────────────────────────
    const handleFecharConta = async () => {
        const totalPago = pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0);
        if (totalPago < (totalFinal - 0.01)) return alert('O total pago é menor que o total do pedido!');
        if (pagamentos.some(p => !p.metodo_pagamento_id)) return alert('Selecione o método de todos os pagamentos!');

        try {
            await apiService.finalizarPedido({
                pedido_id: mesaDetalhe.pedido_id,
                mesa_id: mesaDetalhe.id,
                pagamentos: pagamentos,
                valor_total: totalFinal,
                desconto: descontoValor,
                pessoas_mesa: quantidadePessoas
            });
            setMesaDetalhe(null);
            setShowPagamento(false);
            setCarrinho([]);
            setTaxaServico(taxaPadrao);
            setDescontoValor(0);
            setDescontoPorcentagem(0);
            setQuantidadePessoas(1);
            carregarDados();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao fechar a conta.');
        }
    };

    // ── CÁLCULOS ──────────────────────────────────────────────────────────
    const subtotal       = (mesaDetalhe?.total_acumulado || 0);
    const valorTaxa      = subtotal * (taxaServico / 100);
    const totalParcial   = subtotal + valorTaxa;
    const totalFinal     = totalParcial - descontoValor;
    const itensCarrinho  = agruparItens(carrinho.map(i => ({ ...i, valor: i.preco })));
    const totalCarrinho  = carrinho.reduce((s, i) => s + (i.preco * (i.quantidade || 1)), 0);
    const pedidosDaMesa  = mesaDetalhe?.pedidos || [];

    return (
        <div style={{ padding: '20px' }}>
            <h2>Monitor do Salão (Mesas)</h2>

            {mensagem && (
                <div style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: '#333', color: '#fff', padding: '10px 24px', borderRadius: '50px', zIndex: 9999 }}>
                    {mensagem}
                </div>
            )}

            {/* GRID DE MESAS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '15px' }}>
                {mesasStatus.map(m => (
                    <div key={m.id} onClick={() => { setMesaDetalhe(m); setCarrinho([]); setTaxaServico(taxaPadrao); setQuantidadePessoas(1); }} style={{
                        padding: '20px', borderRadius: '10px', color: '#fff', cursor: 'pointer', textAlign: 'center',
                        backgroundColor: m.pedido_id ? '#e74c3c' : '#27ae60'
                    }}>
                        <strong>Mesa {m.numero}</strong>
                        <p style={{ fontSize: '12px', margin: '4px 0 0' }}>{m.pedido_id ? 'OCUPADA' : 'LIVRE'}</p>
                        {m.pedido_id && m.total_acumulado > 0 && (
                            <p style={{ fontSize: '11px', margin: '2px 0 0', opacity: 0.85 }}>{formatarMoeda(m.total_acumulado)}</p>
                        )}
                    </div>
                ))}
            </div>

            {/* MODAL DA MESA */}
            {mesaDetalhe && (
                <div style={styles.overlay} onClick={e => { if (e.target === e.currentTarget) { setMesaDetalhe(null); setCarrinho([]); setTaxaServico(taxaPadrao); setQuantidadePessoas(1); } }}>
                    <div style={styles.modal}>
                        <div style={styles.header}>
                            <h3 style={{ margin: 0 }}>Mesa {mesaDetalhe.numero} — {mesaDetalhe.pedido_id ? 'Conta Aberta' : 'Livre'}</h3>
                            <button onClick={() => { setMesaDetalhe(null); setCarrinho([]); setTaxaServico(taxaPadrao); setQuantidadePessoas(1); }} className="btn-danger">Sair</button>
                        </div>

                        {mesaDetalhe.pedido_id ? (
                            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                                {/* ESQUERDA: Cardápio */}
                                <div style={{ flex: 1.3, padding: '20px', borderRight: '1px solid #ddd', overflowY: 'auto' }}>
                                    <PedidoModulo onAdicionarItem={adicionarAoCarrinho} />
                                </div>

                                {/* DIREITA: Carrinho + Pedidos enviados + Fechar conta */}
                                <div style={{ flex: 0.7, display: 'flex', flexDirection: 'column', background: 'var(--dark)', overflowY: 'auto' }}>

                                    {/* CARRINHO LOCAL */}
                                    <div style={{ padding: '16px', borderBottom: '1px solid #444' }}>
                                        <h4 style={{ color: '#fff', margin: '0 0 10px' }}>🛒 Carrinho ({itensCarrinho.length})</h4>
                                        {itensCarrinho.length === 0 ? (
                                            <p style={{ color: '#aaa', fontSize: '13px' }}>Selecione itens no cardápio</p>
                                        ) : (
                                            <>
                                                {itensCarrinho.map((item, idx) => (
                                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff', fontSize: '13px', marginBottom: '6px' }}>
                                                        <span>{item.quantidade}x {item.nome}</span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span>{formatarMoeda(item.preco * item.quantidade)}</span>
                                                            <button onClick={() => removerDoCarrinho(idx)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                                                        </div>
                                                    </div>
                                                ))}
                                                <div style={{ borderTop: '1px solid #555', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', color: '#fff', fontWeight: 'bold' }}>
                                                    <span>Total carrinho:</span>
                                                    <span>{formatarMoeda(totalCarrinho)}</span>
                                                </div>
                                                <div style={{ marginTop: '10px' }}>
                                                    <input 
                                                        type="text" 
                                                        placeholder="Observação (Ex: Sem cebola, etc...)" 
                                                        value={observacaoPedido}
                                                        onChange={e => setObservacaoPedido(e.target.value)}
                                                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', background: '#333', color: '#fff', fontSize: '13px' }}
                                                    />
                                                </div>
                                                <button onClick={handleEnviarParaCozinha} className="btn-primary" style={{ width: '100%', marginTop: '10px', padding: '12px', fontWeight: 'bold', fontSize: '14px' }}>
                                                    🚀 ENVIAR PARA COZINHA
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    {/* PEDIDOS JÁ ENVIADOS */}
                                    <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
                                        <h4 style={{ color: '#fff', margin: '0 0 10px' }}>📋 Pedidos da Mesa</h4>
                                        {pedidosDaMesa.length === 0 ? (
                                            <p style={{ color: '#aaa', fontSize: '13px' }}>Nenhum pedido enviado ainda</p>
                                        ) : (
                                            pedidosDaMesa.map((pedido, idx) => {
                                                const badge = STATUS_BADGE[pedido.status] || { bg: '#eee', cor: '#333', label: pedido.status };
                                                const itensDoPedido = mesaDetalhe.itens ? mesaDetalhe.itens.filter(i => i.pedido_id === pedido.id) : [];
                                                return (
                                                    <div key={idx} style={{ background: '#2c2c2c', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                            <span style={{ color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Pedido #{pedido.id}</span>
                                                            <span style={{ background: badge.bg, color: badge.cor, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' }}>
                                                                {badge.label}
                                                            </span>
                                                        </div>
                                                        {itensDoPedido.length > 0 ? (
                                                            <div style={{ margin: '8px 0', paddingLeft: '8px', borderLeft: '2px solid #555' }}>
                                                                {itensDoPedido.map((item, idxi) => (
                                                                    <div key={idxi} style={{ color: '#ccc', fontSize: '12px', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                                        <span>{item.quantidade}x {item.nome || item.produto_nome} {item.observacao ? `(${item.observacao})` : ''}</span>
                                                                        <span>{formatarMoeda(item.quantidade * item.valor)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div style={{ color: '#888', fontSize: '11px', fontStyle: 'italic', margin: '4px 0' }}>Sem itens registrados</div>
                                                        )}
                                                        <div style={{ color: '#55efc4', fontWeight: 'bold', textAlign: 'right', marginTop: '6px', borderTop: '1px dashed #444', paddingTop: '6px' }}>
                                                            Total: {formatarMoeda(pedido.valor_total)}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* TOTAIS E FECHAR CONTA */}
                                    <div className="comanda-footer" style={{ borderTop: '1px solid #444', padding: '20px' }}>
                                        <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '10px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span>Subtotal:</span>
                                                <span>{formatarMoeda(subtotal)}</span>
                                            </div>
                                            
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <span>Taxa Serv. (%)</span>
                                                    <input 
                                                        type="number" 
                                                        value={taxaServico} 
                                                        onChange={e => setTaxaServico(Number(e.target.value))}
                                                        style={{ width: '50px', padding: '2px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', textAlign: 'center' }}
                                                    />
                                                </div>
                                                <span>{formatarMoeda(valorTaxa)}</span>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #444' }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
                                                    <span>Desc.</span>
                                                    <input 
                                                        type="number" 
                                                        placeholder="R$"
                                                        value={descontoValor || ''} 
                                                        onChange={e => {
                                                            const v = Number(e.target.value);
                                                            setDescontoValor(v);
                                                            if (totalParcial > 0) setDescontoPorcentagem(Number(((v / totalParcial) * 100).toFixed(2)));
                                                        }}
                                                        style={{ width: '70px', padding: '2px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}
                                                    />
                                                    <span>ou</span>
                                                    <input 
                                                        type="number" 
                                                        placeholder="%"
                                                        value={descontoPorcentagem || ''} 
                                                        onChange={e => {
                                                            const p = Number(e.target.value);
                                                            setDescontoPorcentagem(p);
                                                            setDescontoValor(Number((totalParcial * (p / 100)).toFixed(2)));
                                                        }}
                                                        style={{ width: '50px', padding: '2px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}
                                                    />
                                                </div>
                                                <span style={{ color: '#ff7675' }}>-{formatarMoeda(descontoValor)}</span>
                                            </div>
                                        </div>

                                        <div className="total-linha" style={{ marginBottom: '10px' }}>
                                            <span>Total: </span>
                                            <span className="total-destaque" style={{ color: '#55efc4' }}>{formatarMoeda(totalFinal)}</span>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', color: '#fff', fontSize: '14px' }}>
                                            <span>Dividir por:</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    value={quantidadePessoas} 
                                                    onChange={e => setQuantidadePessoas(Math.max(1, Number(e.target.value)))}
                                                    style={{ width: '45px', padding: '4px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', textAlign: 'center' }}
                                                />
                                                <span>pessoas</span>
                                            </div>
                                        </div>

                                        {quantidadePessoas > 1 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '10px', background: '#34495e', borderRadius: '8px' }}>
                                                <span style={{ fontSize: '13px', color: '#bdc3c7' }}>Valor por pessoa:</span>
                                                <span style={{ color: '#74b9ff', fontWeight: 'bold', fontSize: '16px' }}>{formatarMoeda(totalFinal / quantidadePessoas)}</span>
                                            </div>
                                        )}
                                        
                                        {subtotal <= 0 && (
                                            <button
                                                onClick={handleCancelarMesaVazia}
                                                className="btn-danger"
                                                style={{ width: '100%', padding: '14px', fontWeight: 'bold', fontSize: '15px', background: '#e74c3c', color: '#fff', marginBottom: '10px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                                🗑️ CANCELAR / LIBERAR MESA VAZIA
                                            </button>
                                        )}
                                        
                                        <button
                                            onClick={() => setShowPagamento(true)}
                                            className="btn-success"
                                            disabled={subtotal <= 0}
                                            style={{ width: '100%', padding: '14px', fontWeight: 'bold', fontSize: '15px', opacity: subtotal <= 0 ? 0.5 : 1, background: '#2ecc71', color: '#fff' }}
                                        >
                                            💳 FECHAR CONTA
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '100px' }}>
                                <button className="btn-success" style={{ padding: '20px 50px', fontSize: '20px' }} onClick={handleAbrirConta}>
                                    ABRIR NOVA CONTA NA MESA {mesaDetalhe.numero}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL DE PAGAMENTO */}
            {showPagamento && (
                <div style={styles.overlayPagamento}>
                    <div style={styles.modalPagamento}>
                        <h2>Fechar Mesa {mesaDetalhe?.numero}</h2>
                        <h1 style={{ color: '#55efc4', margin: '16px 0' }}>{formatarMoeda(totalFinal)}</h1>
                        {quantidadePessoas > 1 && (
                            <h3 style={{ color: '#74b9ff', margin: '0 0 16px', fontWeight: 'normal', fontSize: '18px' }}>
                                Dividido por {quantidadePessoas}: {formatarMoeda(totalFinal / quantidadePessoas)} / pessoa
                            </h3>
                        )}
                        <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '16px' }}>
                            Subtotal {formatarMoeda(subtotal)} + Taxa {taxaServico}% ({formatarMoeda(valorTaxa)}) - Desc. {formatarMoeda(descontoValor)}
                        </p>
                        <MultiPagamento metodos={metodosPagamento} totalPedido={totalFinal} onChange={setPagamentos} tipoPedido="Mesa" />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button onClick={() => setShowPagamento(false)} className="btn-danger" style={{ flex: 1 }}>Voltar</button>
                            <button 
                                onClick={handleFecharConta} 
                                className="btn-success" 
                                style={{ flex: 2, opacity: pagamentos.reduce((s,p) => s + Number(p.valor || 0), 0) < (totalFinal - 0.01) ? 0.5 : 1 }}
                            >
                                CONFIRMAR PAGAMENTO
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    overlay:        { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    modal:          { background: '#fff', width: '95%', height: '90vh', borderRadius: '15px', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    header:         { padding: '15px 20px', background: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd' },
    overlayPagamento: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 },
    modalPagamento: { background: 'var(--dark)', padding: '40px', borderRadius: '15px', width: '460px', textAlign: 'center', color: '#fff' },
};

export default SalaoMonitor;