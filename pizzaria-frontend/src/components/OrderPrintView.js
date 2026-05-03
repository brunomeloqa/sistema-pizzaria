// src/components/OrderPrintView.js
import React from 'react';
import { allPrintableElements } from '../constants/printConstants'; 
import {BACKEND_BASE_URL } from '../constants/apiConstants';

const formatCurrency = (value) => {
    const num = Number(value || 0);
    return `R$ ${num.toFixed(2).replace('.', ',')}`;
};

const renderElement = (key, pedido, config) => {
    switch (key) {
        case 'header':
            return <div className="print-header"><h2>{config?.nome_pizzaria || 'Pizzaria'}</h2></div>;
        case 'num_pedido':
            return <div><strong>Pedido #{pedido.id}</strong></div>;
        case 'dados_cliente':
            return (
                <div>
                    <div>Cliente: {pedido.cliente_nome || pedido.nome_cliente || '—'}</div>
                    <div>End: {pedido.cliente_endereco || pedido.endereco_entrega || '—'}</div>
                </div>
            );
        case 'itens_pedido':
            return (
                <div>
                    <h4>Itens</h4>
                    {Array.isArray(pedido.itens) && pedido.itens.length > 0 ? (
                        <ul>
                            {pedido.itens.map((it, i) => (
                                <li key={i}>
                                    {Number(it.quantidade || it.qtd || 0)}x {it.nome || it.product_name} — {formatCurrency(it.valor || it.price || 0)}
                                    {it.observacao ? ` (${it.observacao})` : ''}
                                </li>
                            ))}
                        </ul>
                    ) : <div>Nenhum item encontrado</div>}
                </div>
            );
        case 'valor_itens':
            return <div>Valor itens: {formatCurrency((pedido.itens || []).reduce((s, it) => s + (Number(it.valor || it.price || 0) * (Number(it.quantidade || it.qtd || 0))), 0))}</div>;
        case 'valor_total':
            return <div><strong>Total: {formatCurrency(pedido.valor_total || 0)}</strong></div>;
        case 'modo_pagamento':
            return (
                <div style={{ fontSize: '12px' }}>
                    <strong>Pagamento:</strong>
                    {Array.isArray(pedido.pagamentos) && pedido.pagamentos.length > 0 ? (
                        <div style={{ marginTop: '4px' }}>
                            {pedido.pagamentos.map((pg, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{pg.metodo_nome || '—'}:</span>
                                    <span>{formatCurrency(pg.valor)}</span>
                                </div>
                            ))}
                            {/* Cálculo de Troco se houver */}
                            {(() => {
                                const totalPagas = pedido.pagamentos.reduce((s, p) => s + (p.valor || 0), 0);
                                const totalPedido = Number(pedido.valor_total || 0);
                                if (totalPagas > totalPedido) {
                                    return (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #ccc', marginTop: '4px', paddingTop: '4px', fontWeight: 'bold' }}>
                                            <span>TROCO:</span>
                                            <span>{formatCurrency(totalPagas - totalPedido)}</span>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>
                    ) : (
                        <span> {pedido.modo_pagamento_nome || '—'}</span>
                    )}
                </div>
            );
        case 'observacao':
            return <div>Obs: {pedido.observacao || '—'}</div>;
        case 'footer':
            return <div className="print-footer">Obrigado!</div>;
        default:
            return null;
    }
};

const OrderPrintView = ({ pedido, config, orderArray }) => {
    if (!pedido || !orderArray) return <div>Carregando dados da comanda..</div>;

    return (
        <div className="order-print-view">
            {orderArray.map((key, idx) => (
                <div key={idx} className={`print-section print-${key}`}>
                    {renderElement(key, pedido, config)}
                </div>
            ))}
        </div>
    );
};

export default OrderPrintView;