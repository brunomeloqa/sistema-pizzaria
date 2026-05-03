import React, { useState, useEffect } from 'react';

const formatarMoeda = (valor) => Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const Comanda = ({ itens, onRemover, total: subtotal, titulo = "Pedido", children, botaoTexto, onFinalizar, desabilitado, onImprimir }) => {
    const [taxaServico, setTaxaServico] = useState(0);
    const [descontoValor, setDescontoValor] = useState(0);
    const [descontoPorcentagem, setDescontoPorcentagem] = useState(0);
    const [trocoPara, setTrocoPara] = useState('');

    // Cálculos derivados
    const valorTaxa = subtotal * (taxaServico / 100);
    const totalParcial = subtotal + valorTaxa;
    const totalFinal = totalParcial - descontoValor;

    // Sincronização: Se o subtotal ou taxa mudar, o valor do desconto (baseado na %) deve mudar
    useEffect(() => {
        if (descontoPorcentagem > 0) {
            const novoValor = totalParcial * (descontoPorcentagem / 100);
            setDescontoValor(Number(novoValor.toFixed(2)));
        }
    }, [subtotal, taxaServico]);

    const handleDescontoValorChange = (val) => {
        const v = Number(val);
        setDescontoValor(v);
        if (totalParcial > 0) {
            setDescontoPorcentagem(Number(((v / totalParcial) * 100).toFixed(2)));
        }
    };

    const handleDescontoPorcentagemChange = (pct) => {
        const p = Number(pct);
        setDescontoPorcentagem(p);
        setDescontoValor(Number((totalParcial * (p / 100)).toFixed(2)));
    };

    const handleFinalizar = () => {
        if (onFinalizar) {
            onFinalizar({
                subtotal,
                taxaServico,
                valorTaxa,
                descontoValor,
                totalFinal,
                trocoPara
            });
        }
    };

    return (
        <div className="col-comanda">
            <div className="comanda-header">
                <h3>🛒 {titulo}</h3>
                <span className="badge-tipo">{itens.length} itens</span>
            </div>

            <div className="comanda-itens">
                {itens.length === 0 && <p style={{ textAlign: 'center', marginTop: '20px', color: '#888' }}>Carrinho vazio</p>}

                {itens.map((item, idx) => (
                    <div key={idx} className="comanda-linha">
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button onClick={() => onRemover(idx)} className="btn-remover-item">×</button>
                                <strong>{item.quantidade}x {item.nome}</strong>
                            </div>
                            {item.observacao && <div className="comanda-obs">{item.observacao}</div>}
                        </div>
                        <div style={{ fontWeight: 'bold' }}>
                            {formatarMoeda(item.preco * item.quantidade)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Aqui entra o componente de Pagamento ou qualquer outro conteúdo extra */}
            {children && <div className="comanda-extra">{children}</div>}

            <div className="comanda-footer">
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
                                onChange={e => handleDescontoValorChange(e.target.value)}
                                style={{ width: '70px', padding: '2px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}
                            />
                            <span>ou</span>
                            <input
                                type="number"
                                placeholder="%"
                                value={descontoPorcentagem || ''}
                                onChange={e => handleDescontoPorcentagemChange(e.target.value)}
                                style={{ width: '50px', padding: '2px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}
                            />
                        </div>
                        <span style={{ color: '#ff7675' }}>-{formatarMoeda(descontoValor)}</span>
                    </div>
                </div>

                <div className="total-linha" style={{ marginBottom: '15px' }}>
                    <span>Total: </span>
                    <span className="total-destaque" style={{ color: '#55efc4' }}>{formatarMoeda(totalFinal)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px' }}>Troco para:</span>
                        <input
                            type="number"
                            placeholder="R$"
                            value={trocoPara}
                            onChange={e => setTrocoPara(e.target.value)}
                            style={{ width: '70px', padding: '6px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}
                        />
                    </div>
                    {Number(trocoPara) > totalFinal && (
                        <div style={{ color: '#f39c12', fontWeight: 'bold', fontSize: '14px' }}>
                            Enviar: {formatarMoeda(Number(trocoPara) - totalFinal)}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        className="btn-success"
                        onClick={handleFinalizar}
                        disabled={desabilitado}
                        style={{ flex: 1 }}
                    >
                        {botaoTexto || 'FINALIZAR'}
                    </button>
                    {onImprimir && (
                        <button
                            onClick={() => onImprimir({ subtotal, taxaServico, valorTaxa, descontoValor, totalFinal, trocoPara, itens })}
                            disabled={itens.length === 0}
                            style={{ padding: '10px 15px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            title="Imprimir Pedido Atual"
                        >
                            🖨️
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Comanda;