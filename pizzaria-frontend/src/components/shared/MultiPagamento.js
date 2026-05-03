import React, { useState, useEffect } from 'react';

const MultiPagamento = ({ metodos, totalPedido, onChange, tipoPedido }) => {
    const [pagamentos, setPagamentos] = useState([
        { metodo_pagamento_id: '', valor: Number(totalPedido).toFixed(2) }
    ]);

    useEffect(() => {
        onChange(pagamentos);
    }, [pagamentos, onChange]);

    // Quando o pedido ganha itens e o total muda, sincroniza automaticamente 
    // se o lojista só tiver adicionado 1 tipo de pagamento
    useEffect(() => {
        setPagamentos(prev => {
            if (prev.length === 1) {
                return [{ ...prev[0], valor: Number(totalPedido).toFixed(2) }];
            }
            return prev;
        });
    }, [totalPedido]);

    const handleAddPagamento = () => {
        const restante = totalPedido - pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0);
        setPagamentos([...pagamentos, { metodo_pagamento_id: '', valor: restante > 0 ? Number(restante).toFixed(2) : '0.00' }]);
    };

    const handleRemovePagamento = (index) => {
        if (pagamentos.length === 1) return;
        const novos = pagamentos.filter((_, i) => i !== index);
        setPagamentos(novos);
    };

    const handleChange = (index, field, value) => {
        const novos = [...pagamentos];
        novos[index][field] = value;
        setPagamentos(novos);
    };

    const totalPago = pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0);
    const restante = totalPedido - totalPago;

    // Filtra os métodos: se não for Delivery, esconde os que são cupom
    const metodosFiltrados = metodos.filter(m => (tipoPedido === 'Delivery' || Number(m.is_cupom) !== 1));

    return (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px', marginTop: '10px' }}>
            <h4 style={{ color: '#fff', marginTop: 0, marginBottom: '15px', fontSize: '14px' }}>💳 Formas de Pagamento</h4>
            
            <div style={{ maxHeight: '160px', overflowY: 'auto', paddingRight: '5px' }}>
                {pagamentos.map((pg, index) => (
                    <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
                        <select 
                            value={pg.metodo_pagamento_id} 
                            onChange={(e) => handleChange(index, 'metodo_pagamento_id', e.target.value)}
                            style={{ flex: 2, padding: '10px', borderRadius: '5px', border: '1px solid #444', background: '#333', color: '#fff' }}
                        >
                            <option value="">Selecione...</option>
                            {metodosFiltrados.map(m => (
                                <option key={m.id} value={m.id}>{m.nome}</option>
                            ))}
                        </select>
                        <input 
                            type="number" 
                            placeholder="R$" 
                            value={pg.valor} 
                            onChange={(e) => handleChange(index, 'valor', e.target.value)}
                            style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #444', background: '#333', color: '#fff', textAlign: 'right' }}
                        />
                        {pagamentos.length > 1 && (
                            <button 
                                onClick={() => handleRemovePagamento(index)}
                                style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '5px', width: '35px', height: '40px', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
                <button 
                    onClick={handleAddPagamento}
                    style={{ background: 'transparent', color: '#3498db', border: '1px border #3498db', padding: '5px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                >
                    + Adicionar Outra Forma
                </button>
                
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: restante > 0 ? '#e67e22' : '#2ecc71' }}>
                        {restante > 0 ? `Restante: R$ ${restante.toFixed(2)}` : (restante < 0 ? `Troco: R$ ${Math.abs(restante).toFixed(2)}` : 'Total Pago ✅')}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MultiPagamento;
