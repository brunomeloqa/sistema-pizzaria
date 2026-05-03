import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
// Importando os helpers para manter o código limpo
import { filtrarProdutos, calcularPrecoPizza, formatarMoeda } from '../../utils/helpers';

const PedidoModulo = ({ onAdicionarItem }) => {
    const [produtos, setProdutos] = useState([]);
    const [busca, setBusca] = useState('');
    const [montandoPizza, setMontandoPizza] = useState(false);
    const [calculoPizza, setCalculoPizza] = useState('maior');
    
    // Estado inicial para quando começar uma nova pizza
    const pizzaInicial = {
        tamanho: 'Grande',
        qtdSaboresPermitidos: 1,
        saboresSelecionados: [],
        observacao: ''
    };
    const [pizzaAtual, setPizzaAtual] = useState(pizzaInicial);

    useEffect(() => {
        apiService.listarProdutos()
            .then(res => {
                const lista = res.data.data || res.data || [];
                setProdutos(lista);
            })
            .catch(err => console.error("Erro ao carregar cardápio:", err));

        apiService.getConfiguracoes()
            .then(res => {
                const modo = res.data?.data?.calculo_pizza;
                if (modo) setCalculoPizza(modo);
            })
            .catch(() => {});
    }, []);

    // Lógica para selecionar/remover sabores da pizza
    const toggleSabor = (sabor) => {
        const jaSelecionado = pizzaAtual.saboresSelecionados.find(s => s.id === sabor.id);
        
        if (jaSelecionado) {
            setPizzaAtual({
                ...pizzaAtual,
                saboresSelecionados: pizzaAtual.saboresSelecionados.filter(s => s.id !== sabor.id)
            });
        } else if (pizzaAtual.saboresSelecionados.length < pizzaAtual.qtdSaboresPermitidos) {
            setPizzaAtual({
                ...pizzaAtual,
                saboresSelecionados: [...pizzaAtual.saboresSelecionados, sabor]
            });
        }
    };

    // Quando o usuário termina de montar a pizza e clica em "Adicionar"
    const handleFinalizarPizza = () => {
        if (pizzaAtual.saboresSelecionados.length === 0) {
            return alert("Selecione pelo menos um sabor!");
        }
        
        const precoFinal = calcularPrecoPizza(pizzaAtual.saboresSelecionados, pizzaAtual.tamanho, calculoPizza);
        const nomesSabores = pizzaAtual.saboresSelecionados.map(s => s.nome).join(' / ');

        // Envia o objeto formatado para o componente pai (Salao ou PedidoNovo)
        onAdicionarItem({
            id: `pizza-${Date.now()}`, // ID temporário para controle de lista
            nome: `Pizza ${pizzaAtual.tamanho} (${nomesSabores})`,
            preco: precoFinal,
            observacao: pizzaAtual.observacao,
            isPizza: true,
            quantidade: 1
        });

        // Reseta o modo pizza
        setMontandoPizza(false);
        setPizzaAtual(pizzaInicial);
    };

    const produtosFiltrados = filtrarProdutos(produtos, busca, montandoPizza);

    return (
        <div className="pedido-modulo">
            <style>{`
                .grid-produtos { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
                .item-card { background: #fff; border: 1px solid #eee; padding: 12px; borderRadius: 10px; transition: 0.2s; position: relative; }
                .item-card:hover { border-color: #3498db; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
                .btn-add-item { background: #27ae60; color: #fff; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-weight: bold; font-size: 18px; }
                .btn-sabor-check { background: #3498db; color: #fff; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; }
                .badge-sabor { position: absolute; top: -5px; right: -5px; background: #e67e22; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 10px; }
            `}</style>

            {/* BARRA DE FERRAMENTAS */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button 
                    className={montandoPizza ? "btn-danger" : "btn-primary"} 
                    onClick={() => { setMontandoPizza(!montandoPizza); setBusca(''); }}
                    style={{ flex: 1, padding: '12px', fontWeight: 'bold' }}
                >
                    {montandoPizza ? '⬅ CANCELAR PIZZA' : '🍕 MONTAR PIZZA'}
                </button>
                <input 
                    className="input-busca" 
                    placeholder={montandoPizza ? "Buscar sabor..." : "Buscar produto..."} 
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    style={{ flex: 2 }}
                />
            </div>

            {/* SELETOR DE TAMANHO E QTD (SÓ NO MODO PIZZA) */}
            {montandoPizza && (
                <div style={{ background: '#fff', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '2px solid #e67e22', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block' }}>TAMANHO:</label>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            {[
                                { value: 'Grande', label: 'Grande' },
                                { value: 'Média', label: 'Broto' }
                            ].map(({ value, label }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setPizzaAtual({ ...pizzaAtual, tamanho: value })}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '5px',
                                        border: 'none',
                                        background: pizzaAtual.tamanho === value ? '#e67e22' : '#eee',
                                        color: pizzaAtual.tamanho === value ? '#fff' : '#333',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block' }}>SABORES:</label>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            {[1, 2, 3].map(n => (
                                <button 
                                    key={n} 
                                    onClick={() => setPizzaAtual({...pizzaAtual, qtdSaboresPermitidos: n, saboresSelecionados: []})}
                                    style={{ 
                                        padding: '8px 15px', 
                                        borderRadius: '5px', 
                                        border: 'none',
                                        background: pizzaAtual.qtdSaboresPermitidos === n ? '#e67e22' : '#eee',
                                        color: pizzaAtual.qtdSaboresPermitidos === n ? '#fff' : '#333',
                                        cursor: 'pointer'
                                    }}
                                >{n}</button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* BARRA DE CONCLUSÃO DA PIZZA (MOVIDA PARA CIMA) */}
            {montandoPizza && (
                <div style={{ marginBottom: '20px', background: '#f8f9fa', padding: '15px', borderRadius: '10px', border: '2px solid #2ecc71' }}>
                    <textarea 
                        className="input-busca" 
                        placeholder="Observações da pizza (ex: sem cebola, borda recheada...)" 
                        value={pizzaAtual.observacao}
                        onChange={e => setPizzaAtual({...pizzaAtual, observacao: e.target.value})}
                        style={{ width: '100%', height: '60px', marginBottom: '10px' }}
                    />
                    <button 
                        className="btn-success" 
                        onClick={handleFinalizarPizza} 
                        style={{ width: '100%', padding: '15px', fontSize: '16px', fontWeight: 'bold' }}
                    >
                        ✓ ADICIONAR PIZZA AO PEDIDO ({pizzaAtual.saboresSelecionados.length}/{pizzaAtual.qtdSaboresPermitidos})
                    </button>
                </div>
            )}

            {/* LISTA DE PRODUTOS / SABORES */}
            <div className="grid-produtos">
                {produtosFiltrados.map(p => {
                    const selecionado = pizzaAtual.saboresSelecionados.find(s => s.id === p.id);
                    const precoExibido = montandoPizza && pizzaAtual.tamanho === 'Média' ? (p.preco_broto || p.preco) : p.preco;

                    return (
                        <div key={p.id} className="item-card" style={{ background: selecionado ? '#fff3e0' : '#fff' }}>
                            {selecionado && <span className="badge-sabor">✓</span>}
                            <div style={{ marginBottom: '10px' }}>
                                <div style={{ fontSize: '11px', color: '#999', marginBottom: '2px' }}>COD: {p.id}</div>
                                <div style={{ fontWeight: 'bold', fontSize: '14px', lineHeight: '1.2' }}>{p.nome}</div>
                                <div style={{ color: '#27ae60', fontWeight: 'bold', marginTop: '5px' }}>{formatarMoeda(precoExibido)}</div>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                {montandoPizza ? (
                                    <button 
                                        className="btn-sabor-check" 
                                        onClick={() => toggleSabor(p)}
                                        style={{ background: selecionado ? '#e67e22' : '#3498db' }}
                                    >
                                        {selecionado ? '−' : '+'}
                                    </button>
                                ) : (
                                    <button 
                                        className="btn-add-item" 
                                        onClick={() => onAdicionarItem({...p, quantidade: 1})}
                                    >+</button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

        </div>
    );
};

export default PedidoModulo;