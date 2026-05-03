import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PERIODOS = [
    { value: 'dia', label: 'Hoje' },
    { value: 'semana', label: '7 dias' },
    { value: 'mes', label: '30 dias' },
    { value: 'custom', label: 'Personalizado' },
    { value: '', label: 'Tudo' },
];

const TIPO_CORES = { Mesa: '#3498db', Delivery: '#e67e22', Balcão: '#27ae60', Balcão: '#27ae60' };
const ATEND_ICONE = { Mesa: '🪑', Delivery: '🛵', Balcão: '🚶', Balcão: '🚶' };

// Barra horizontal simples
const BarraHoriz = ({ label, valor, max, cor = '#e67e22', sufixo = '', textoValor }) => {
    const pct = max > 0 ? (valor / max) * 100 : 0;
    return (
        <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                <span style={{ fontWeight: 500 }}>{label}</span>
                <span style={{ color: '#666' }}>{textoValor !== undefined ? textoValor : valor}{sufixo}</span>
            </div>
            <div style={{ background: '#eee', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: cor, borderRadius: '4px', transition: 'width 0.5s ease' }} />
            </div>
        </div>
    );
};

// Bloco de card de seção
const Bloco = ({ titulo, children, icone }) => (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 18px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{icone}</span> {titulo}
        </h3>
        {children}
    </div>
);

const Relatorios = () => {
    const [periodo, setPeriodo] = useState('mes');
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [loading, setLoading] = useState(false);

    const [maisVendidos, setMaisVendidos] = useState([]);
    const [saboresPizza, setSaboresPizza] = useState([]);
    const [bairros, setBairros] = useState([]);
    const [tipoAtend, setTipoAtend] = useState([]);
    const [horarios, setHorarios] = useState([]);
    const [entregadores, setEntregadores] = useState([]);
    const [pizzasPorDia, setPizzasPorDia] = useState([]);
    const [pizzasPorTamanho, setPizzasPorTamanho] = useState([]);
    const [modosPagamento, setModosPagamento] = useState([]);

    const carregar = useCallback(async () => {
        setLoading(true);
        try {
            const di = periodo === 'custom' ? dataInicio : undefined;
            const df = periodo === 'custom' ? dataFim : undefined;

            const [r1, r2, r3, r4, r5, r6, r7, r8, r9] = await Promise.all([
                apiService.getRelatorioMaisVendidos(periodo, di, df),
                apiService.getRelatorioSaboresPizza(periodo, di, df),
                apiService.getRelatorioBairros(periodo, di, df),
                apiService.getRelatorioTipoAtendimento(periodo, di, df),
                apiService.getRelatorioHorarios(periodo, di, df),
                apiService.getRelatorioEntregadores(periodo, di, df),
                apiService.getRelatorioPizzasPorDia(periodo, di, df),
                apiService.getRelatorioPizzasPorTamanho(periodo, di, df),
                apiService.getRelatorioModoPagamento(periodo, di, df),
            ]);
            setMaisVendidos(r1.data.data || []);
            setSaboresPizza(r2.data.data || []);
            setBairros(r3.data.data || []);
            setTipoAtend(r4.data.data || []);
            setHorarios(r5.data.data || []);
            setEntregadores(r6.data.data || []);
            setPizzasPorDia(r7.data.data || []);
            setPizzasPorTamanho(r8.data.data || []);
            setModosPagamento(r9.data.data || []);
        } catch (e) {
            console.error('Erro ao carregar relatórios:', e);
        } finally {
            setLoading(false);
        }
    }, [periodo, dataInicio, dataFim]);

    useEffect(() => { carregar(); }, [carregar]);

    const maxVendidos = Math.max(...maisVendidos.map(i => i.total_vendido), 1);
    const maxSabores = Math.max(...saboresPizza.map(i => i.total_vendido), 1);
    const maxBairros = Math.max(...bairros.map(i => i.total_pedidos), 1);
    const maxHorarios = Math.max(...horarios.map(i => i.total_pedidos), 1);
    const maxEntregad = Math.max(...entregadores.map(i => i.quantidade_entregas_dia), 1);
    const maxPizzasDia = Math.max(...pizzasPorDia.map(i => i.total_pizzas), 1);
    const maxPizzasTam = Math.max(...pizzasPorTamanho.map(i => i.total_pizzas), 1);
    const maxPagamentos = Math.max(...modosPagamento.map(i => i.total_recebido), 1);
    const totalAtend = tipoAtend.reduce((s, i) => s + i.total_pedidos, 0);

    // Array de todas 24h para o mapa de calor
    const horasCompletas = Array.from({ length: 24 }, (_, h) => {
        const found = horarios.find(r => r.hora === h);
        return { hora: h, total_pedidos: found ? found.total_pedidos : 0 };
    });

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>

            {/* CABEÇALHO */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <h2 style={{ margin: 0 }}>📈 Relatórios Gerenciais</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {PERIODOS.map(p => (
                        <button
                            key={p.value}
                            onClick={() => setPeriodo(p.value)}
                            style={{
                                padding: '8px 18px', borderRadius: '20px', border: 'none',
                                cursor: 'pointer', fontWeight: 'bold', fontSize: '13px',
                                background: periodo === p.value ? '#e67e22' : '#eee',
                                color: periodo === p.value ? '#fff' : '#555',
                                transition: 'all 0.2s'
                            }}
                        >
                            {p.label}
                        </button>
                    ))}
                    
                    {periodo === 'custom' && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '10px' }}>
                            <input 
                                type="date" 
                                value={dataInicio} 
                                onChange={e => setDataInicio(e.target.value)} 
                                style={{ padding: '6px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: 0 }}
                                title="Data Inicial"
                            />
                            <span style={{ color: '#555' }}>até</span>
                            <input 
                                type="date" 
                                value={dataFim} 
                                onChange={e => setDataFim(e.target.value)} 
                                style={{ padding: '6px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: 0 }}
                                title="Data Final"
                            />
                        </div>
                    )}

                    <button onClick={carregar} style={{ padding: '8px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', background: '#3498db', color: '#fff', marginLeft: '8px' }} title="Recarregar">
                        🔄
                    </button>
                </div>
            </div>

            {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>⏳ Carregando relatórios...</div>}

            {!loading && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '20px' }}>

                    {/* 1. ITENS MAIS VENDIDOS */}
                    <Bloco titulo="Itens Mais Vendidos" icone="🏆">
                        {maisVendidos.length === 0
                            ? <p style={{ color: '#999' }}>Sem dados para o período.</p>
                            : maisVendidos.map((item, i) => (
                                <BarraHoriz key={i} label={`#${i + 1} ${item.nome}`} valor={item.total_vendido} max={maxVendidos} sufixo=" un." cor="#3498db" />
                            ))
                        }
                    </Bloco>

                    {/* 2. SABORES DE PIZZA */}
                    <Bloco titulo="Sabores de Pizza Mais Pedidos" icone="🍕">
                        {saboresPizza.length === 0
                            ? <p style={{ color: '#999' }}>Sem dados para o período.</p>
                            : saboresPizza.map((item, i) => (
                                <BarraHoriz key={i} label={`#${i + 1} ${item.nome}`} valor={item.total_vendido} max={maxSabores} sufixo=" un." cor="#e67e22" />
                            ))
                        }
                    </Bloco>

                    {/* PIZZAS POR TAMANHO E DIA */}
                    <Bloco titulo="Pizzas por Tamanho" icone="📏">
                        {pizzasPorTamanho.length === 0
                            ? <p style={{ color: '#999' }}>Sem dados para o período.</p>
                            : pizzasPorTamanho.map((item, i) => (
                                <BarraHoriz key={i} label={item.tamanho} valor={item.total_pizzas} max={maxPizzasTam} sufixo=" pizzas" cor="#f39c12" />
                            ))
                        }
                    </Bloco>

                    <Bloco titulo="Evolução: Pizzas Vendidas por Dia" icone="📅">
                        {pizzasPorDia.length === 0
                            ? <p style={{ color: '#999' }}>Sem dados para o período.</p>
                            : <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {pizzasPorDia.map((item, i) => {
                                    // Formatar a data (YYYY-MM-DD -> DD/MM)
                                    const d = new Date(item.data + 'T00:00:00');
                                    const dia = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth()+1).padStart(2, '0');
                                    return (
                                        <BarraHoriz key={i} label={dia} valor={item.total_pizzas} max={maxPizzasDia} sufixo=" pizzas" cor="#16a085" />
                                    );
                                })}
                            </div>
                        }
                    </Bloco>

                    {/* 3. BAIRROS */}
                    <Bloco titulo="Bairros com Mais Pedidos (Delivery)" icone="📍">
                        {bairros.length === 0
                            ? <p style={{ color: '#999' }}>Sem dados para o período.</p>
                            : bairros.map((item, i) => (
                                <div key={i} style={{ marginBottom: '10px' }}>
                                    <BarraHoriz label={item.bairro} valor={item.total_pedidos} max={maxBairros} sufixo=" pedidos" cor="#9b59b6" />
                                    <div style={{ fontSize: '11px', color: '#999', marginTop: '-6px', textAlign: 'right' }}>
                                        Receita: {fmt(item.receita_total)} | Descontos: {fmt(item.total_descontos)}
                                    </div>
                                </div>
                            ))
                        }
                    </Bloco>

                    {/* 4. TIPO DE ATENDIMENTO */}
                    <Bloco titulo="Pedidos por Tipo de Atendimento" icone="📊">
                        {tipoAtend.length === 0
                            ? <p style={{ color: '#999' }}>Sem dados para o período.</p>
                            : <div>
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                    {tipoAtend.map((item, i) => {
                                        const pct = totalAtend > 0 ? ((item.total_pedidos / totalAtend) * 100).toFixed(1) : 0;
                                        return (
                                            <div key={i} style={{
                                                flex: 1, minWidth: '120px', textAlign: 'center', padding: '16px',
                                                borderRadius: '10px', background: TIPO_CORES[item.tipo] + '18',
                                                border: `2px solid ${TIPO_CORES[item.tipo] || '#ccc'}`
                                            }}>
                                                <div style={{ fontSize: '28px' }}>{ATEND_ICONE[item.tipo] || '📦'}</div>
                                                <div style={{ fontWeight: 'bold', fontSize: '20px' }}>{item.total_pedidos}</div>
                                                <div style={{ fontSize: '12px', color: '#666' }}>{item.tipo}</div>
                                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: TIPO_CORES[item.tipo] || '#333' }}>{pct}%</div>
                                                <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>Receita: {fmt(item.receita_total)}</div>
                                                <div style={{ fontSize: '10px', color: '#ff7675' }}>Desc: {fmt(item.total_descontos)}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        }
                    </Bloco>

                    {/* 5. HORÁRIOS DE PICO */}
                    <Bloco titulo="Horários de Criação de Pedidos" icone="🕐">
                        {horarios.length === 0
                            ? <p style={{ color: '#999' }}>Sem dados para o período.</p>
                            : <div>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '100px', marginBottom: '8px' }}>
                                    {horasCompletas.map(h => {
                                        const altura = maxHorarios > 0 ? (h.total_pedidos / maxHorarios) * 90 : 0;
                                        const destaque = h.total_pedidos === maxHorarios && h.total_pedidos > 0;
                                        return (
                                            <div key={h.hora} title={`${h.hora}h: ${h.total_pedidos} pedidos`}
                                                style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100px' }}>
                                                <div style={{
                                                    width: '100%', height: `${Math.max(altura, h.total_pedidos > 0 ? 4 : 0)}px`,
                                                    background: destaque ? '#e74c3c' : '#3498db',
                                                    borderRadius: '3px 3px 0 0',
                                                    transition: 'height 0.4s ease'
                                                }} />
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#aaa' }}>
                                    {[0, 4, 8, 12, 16, 20, 23].map(h => <span key={h}>{h}h</span>)}
                                </div>
                                {maxHorarios > 0 && (
                                    <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                                        🔴 Pico: {horasCompletas.find(h => h.total_pedidos === maxHorarios)?.hora}h com {maxHorarios} pedido(s)
                                    </p>
                                )}
                            </div>
                        }
                    </Bloco>

                    {/* 6. ENTREGADORES */}
                    <Bloco titulo="Entregas por Entregador (Dia Atual)" icone="🛵">
                        {entregadores.filter(e => e.ativo !== 0).length === 0
                            ? <p style={{ color: '#999' }}>Nenhum entregador cadastrado.</p>
                            : entregadores.filter(e => e.ativo !== 0).map((ent, i) => (
                                <div key={i} style={{ marginBottom: '12px' }}>
                                    <BarraHoriz
                                        label={`${ent.nome} (ID: ${ent.id})`}
                                        valor={ent.quantidade_entregas_dia || 0}
                                        max={maxEntregad}
                                        sufixo=" entregas"
                                        cor="#27ae60"
                                    />
                                    {ent.contato && <div style={{ fontSize: '11px', color: '#999', marginTop: '-6px' }}>📞 {ent.contato}</div>}
                                </div>
                            ))
                        }
                    </Bloco>

                    {/* 7. MODOS DE PAGAMENTO */}
                    <Bloco titulo="Receitas por Forma de Pagamento" icone="💳">
                        {modosPagamento.length === 0
                            ? <p style={{ color: '#999' }}>Sem dados para o período.</p>
                            : modosPagamento.map((item, i) => (
                                <BarraHoriz 
                                    key={i} 
                                    label={item.nome || 'Não identificado'} 
                                    valor={item.total_recebido} 
                                    textoValor={fmt(item.total_recebido)}
                                    max={maxPagamentos} 
                                    sufixo="" 
                                    cor="#e74c3c" 
                                />
                            ))
                        }
                        {modosPagamento.length > 0 && (
                            <div style={{ marginTop: '10px', fontSize: '14px', fontWeight: 'bold', textAlign: 'right', color: '#2c3e50' }}>
                                Total: {fmt(modosPagamento.reduce((s, i) => s + (i.total_recebido || 0), 0))}
                            </div>
                        )}
                    </Bloco>

                </div>
            )}
        </div>
    );
};

export default Relatorios;