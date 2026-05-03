import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

// IMPORTAÇÃO DOS COMPONENTES E HELPERS
import PedidoModulo from './shared/PedidoModulo';
import Comanda from './shared/Comanda';
import MultiPagamento from './shared/MultiPagamento';
import { agruparItens, mascararCEP, mascararTelefone, mascararCelular } from '../utils/helpers';
import { printHTMLContent } from '../utils/printUtils';

const PedidoNovo = () => {
    // Estados do sistema
    const [tipoPedido, setTipoPedido] = useState('Delivery');
    const [carrinho, setCarrinho] = useState([]);

    // ATENÇÃO AQUI: Agora usamos um array para split payment
    const [pagamentos, setPagamentos] = useState([]);
    const [pagamentoNaEntrega, setPagamentoNaEntrega] = useState(true); // Padrão: Pagar depois
    const [observacaoPedido, setObservacaoPedido] = useState('');

    const [metodosPagamento, setMetodosPagamento] = useState([]);
    const [mensagem, setMensagem] = useState('');

    // Estados do Cliente (Delivery)
    const [buscaTelefone, setBuscaTelefone] = useState('');
    const [clienteSelecionado, setClienteSelecionado] = useState(null);
    const [clientesEncontrados, setClientesEncontrados] = useState([]);
    const [mostrarDropdownBusca, setMostrarDropdownBusca] = useState(false);
    const [nomeCliente, setNomeCliente] = useState('');
    const [exibirFormCliente, setExibirFormCliente] = useState(false);
    const [novoCliente, setNovoCliente] = useState({
        nome: '', telefone: '', celular: '', CEP: '',
        endereco: '', numero: '', bairro: '', complemento: '', observacao: ''
    });
    const [enderecoAlternativo, setEnderecoAlternativo] = useState('');
    const [complementoAlternativo, setComplementoAlternativo] = useState('');

    const [rascunhos, setRascunhos] = useState([]);
    const [abaAtivaId, setAbaAtivaId] = useState('novo'); 
    const [isRestoring, setIsRestoring] = useState(false);

    useEffect(() => {
        carregarRascunhos();
        apiService.listarModosPagamento()
            .then(res => setMetodosPagamento(res.data.data || res.data || []))
            .catch(err => console.error("Erro ao carregar pagamentos:", err));
    }, []);

    const carregarRascunhos = async () => {
        try {
            const res = await apiService.listarRascunhos();
            setRascunhos(res.data?.data || []);
        } catch(e) { console.error('Erro ao listar rascunhos', e); }
    };

    // Auto-save Rascunho
    useEffect(() => {
        if (isRestoring) return;
        if (carrinho.length === 0 && !clienteSelecionado && !nomeCliente && abaAtivaId === 'novo') return;

        const handler = setTimeout(async () => {
            const dados = {
                tipoPedido, carrinho, pagamentos, pagamentoNaEntrega, observacaoPedido,
                clienteSelecionado, nomeCliente, enderecoAlternativo, complementoAlternativo
            };
            const desc = tipoPedido === 'Delivery' && clienteSelecionado ? `Delivery: ${clienteSelecionado.nome}` : (nomeCliente ? `Balcão: ${nomeCliente}` : (tipoPedido === 'Delivery' ? 'Novo Delivery' : 'Novo Balcão'));
            const qtdItens = carrinho.reduce((acc, i) => acc + (i.quantidade || 1), 0);
            const identificacao = `${desc} (${qtdItens} itens)`;
            
            try {
                if (abaAtivaId === 'novo') {
                    const res = await apiService.criarRascunho({ identificacao, dados_json: JSON.stringify(dados) });
                    const novoId = res.data.id;
                    setAbaAtivaId(novoId);
                    carregarRascunhos();
                } else {
                    await apiService.atualizarRascunho(abaAtivaId, { identificacao, dados_json: JSON.stringify(dados) });
                    setRascunhos(prev => prev.map(r => r.id === abaAtivaId ? { ...r, identificacao, dados_json: JSON.stringify(dados) } : r));
                }
            } catch(e) { console.error("Erro auto-save", e); }
        }, 800);

        return () => clearTimeout(handler);
    }, [carrinho, tipoPedido, clienteSelecionado, pagamentos, observacaoPedido, pagamentoNaEntrega, enderecoAlternativo, complementoAlternativo, nomeCliente, abaAtivaId, isRestoring]);

    const selecionarAba = (rascunho) => {
        if (rascunho === 'novo') {
            if (rascunhos.length >= 10 && abaAtivaId !== 'novo') {
                return mostrarMensagem("Limite de abas de rascunhos alcançado (10).");
            }
            setIsRestoring(true);
            setAbaAtivaId('novo');
            setTipoPedido('Delivery');
            setCarrinho([]);
            setPagamentos([]);
            setPagamentoNaEntrega(true);
            setObservacaoPedido('');
            setClienteSelecionado(null);
            setNomeCliente('');
            setEnderecoAlternativo('');
            setComplementoAlternativo('');
            setTimeout(() => setIsRestoring(false), 200);
        } else {
            setIsRestoring(true);
            setAbaAtivaId(rascunho.id);
            try {
                const dados = JSON.parse(rascunho.dados_json);
                setTipoPedido(dados.tipoPedido || 'Delivery');
                setCarrinho(dados.carrinho || []);
                setPagamentos(dados.pagamentos || []);
                setPagamentoNaEntrega(dados.pagamentoNaEntrega !== undefined ? dados.pagamentoNaEntrega : true);
                setObservacaoPedido(dados.observacaoPedido || '');
                setClienteSelecionado(dados.clienteSelecionado || null);
                setNomeCliente(dados.nomeCliente || '');
                setEnderecoAlternativo(dados.enderecoAlternativo || '');
                setComplementoAlternativo(dados.complementoAlternativo || '');
            } catch(e) { console.error("Erro parse rascunho", e); }
            setTimeout(() => setIsRestoring(false), 200);
        }
    };

    const fecharAba = async (id, e) => {
        e.stopPropagation();
        if (window.confirm("Deseja realmente cancelar este rascunho de pedido?")) {
            try {
                await apiService.deletarRascunho(id);
                if (abaAtivaId === id) {
                    selecionarAba('novo');
                }
                carregarRascunhos();
            } catch(err) {
                console.error("Erro ao deletar rascunho", err);
            }
        }
    };

    const mostrarMensagem = (msg) => {
        setMensagem(msg);
        setTimeout(() => setMensagem(''), 3000);
    };

    const adicionarAoCarrinho = (item) => {
        setCarrinho(prev => [...prev, item]);
        mostrarMensagem(`${item.nome} adicionado!`);
    };

    const removerDoCarrinho = (idx) => {
        setCarrinho(prev => prev.filter((_, i) => i !== idx));
    };

    const handleCepBlur = async (e) => {
        const cep = e.target.value.replace(/\D/g, '');
        if (cep.length === 8) {
            try {
                const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then(r => r.json());
                if (!res.erro) {
                    setNovoCliente(prev => ({ ...prev, endereco: res.logradouro, bairro: res.bairro }));
                }
            } catch (err) {
                console.error("Erro ao buscar CEP:", err);
            }
        }
    };

    const handleBuscaChange = async (e) => {
        const val = e.target.value;
        setBuscaTelefone(val);

        if (val.length >= 4) {
            try {
                const res = await apiService.buscarClientePorTelefone(val);
                const clientes = res.data?.data || [];
                if (clientes.length > 0) {
                    setClientesEncontrados(clientes);
                    setMostrarDropdownBusca(true);
                } else {
                    setClientesEncontrados([]);
                    setMostrarDropdownBusca(false);
                }
            } catch (err) {
                setClientesEncontrados([]);
                setMostrarDropdownBusca(false);
            }
        } else {
            setClientesEncontrados([]);
            setMostrarDropdownBusca(false);
        }
    };

    const handleBuscarCliente = async () => {
        if (!buscaTelefone) return;
        try {
            const res = await apiService.buscarClientePorTelefone(buscaTelefone);
            const clientes = res.data?.data || [];
            if (clientes && Array.isArray(clientes) && clientes.length > 0) {
                if (clientes.length === 1) {
                    setClienteSelecionado(clientes[0]);
                    setBuscaTelefone('');
                    setMostrarDropdownBusca(false);
                    mostrarMensagem("Cliente localizado!");
                } else {
                    setClientesEncontrados(clientes);
                    setMostrarDropdownBusca(true);
                }
            } else {
                setNovoCliente({ ...novoCliente, telefone: buscaTelefone, celular: buscaTelefone, nome: buscaTelefone.replace(/[0-9()\- ]/g, '').length > 2 ? buscaTelefone : '' });
                setMostrarDropdownBusca(false);
                setExibirFormCliente(true);
            }
        } catch (err) {
            setNovoCliente({ ...novoCliente, telefone: buscaTelefone, celular: buscaTelefone });
            setMostrarDropdownBusca(false);
            setExibirFormCliente(true);
        }
    };

    const handleSalvarCliente = async () => {
        try {
            const res = await apiService.criarCliente(novoCliente);
            const cliente = res.data?.data || res.data;
            setClienteSelecionado(cliente);
            setExibirFormCliente(false);
            mostrarMensagem("Cliente cadastrado com sucesso!");
        } catch (err) {
            if (err.response?.status === 409) {
                const msg = err.response?.data?.error || 'Este telefone já está cadastrado.';
                mostrarMensagem(msg + ' Busque pelo telefone para usar o cliente existente.');
                if (novoCliente.telefone) {
                    try {
                        const res = await apiService.buscarClientePorTelefone(novoCliente.telefone);
                        const cliente = res.data?.data || res.data;
                        let clienteEncontrado = (Array.isArray(cliente) ? cliente[0] : cliente);
                        if (clienteEncontrado && clienteEncontrado.id) {
                            setClienteSelecionado(clienteEncontrado);
                            setBuscaTelefone('');
                            setExibirFormCliente(false);
                            setMostrarDropdownBusca(false);
                            mostrarMensagem("Cliente existente selecionado. Pode continuar o pedido.");
                        }
                    } catch (_) { /* mantém modal aberto */ }
                }
                return;
            }
            alert(err.response?.data?.error || "Erro ao salvar cliente.");
        }
    };

    const itensAgrupados = agruparItens(carrinho);
    const totalCarrinho = carrinho.reduce((acc, i) => acc + (i.preco * (i.quantidade || 1)), 0);

    const imprimirPedidoAtual = (dadosComanda) => {
        const obs = observacaoPedido ? `Obs: ${observacaoPedido}` : '';
        const itensHtml = itensAgrupados.map((grp) => `
            <div style="font-weight:bold; margin-top:10px; font-size: 14px; text-decoration: underline;">${grp.categoria}</div>
            ${grp.itens.map(i => `
                <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #ccc; padding-bottom:5px; margin-bottom:5px;">
                    <span>${i.quantidade || 1}x ${i.nome}</span>
                    <span>R$ ${Number(i.preco * (i.quantidade || 1)).toFixed(2)}</span>
                </div>
                ${i.observacao ? `<div style="font-size:10px; color:#555;">- ${i.observacao}</div>` : ''}
            `).join('')}
        `).join('');

        const endHtml = tipoPedido === 'Delivery' && clienteSelecionado ? `
            <hr />
            <strong>CLIENTE:</strong> ${clienteSelecionado.nome}<br />
            <strong>TEL:</strong> ${clienteSelecionado.telefone}<br />
            <strong>ENDEREÇO:</strong> ${enderecoAlternativo || clienteSelecionado.endereco}, ${(clienteSelecionado.numero || 'S/N')}
            ${complementoAlternativo || clienteSelecionado.complemento ? `<br />COMP: ${complementoAlternativo || clienteSelecionado.complemento}` : ''}
        ` : (nomeCliente ? `<hr /><strong>CLIENTE:</strong> ${nomeCliente}` : '');

        const subtotal = dadosComanda?.subtotal || totalCarrinho;
        const totalFinal = dadosComanda?.totalFinal || subtotal; 
        const trocoPara = dadosComanda?.trocoPara || 0;
        const valorTaxa = dadosComanda?.valorTaxa || 0;
        const descontoValor = dadosComanda?.descontoValor || 0;

        const printContent = `
            <div style="font-family: monospace; font-size: 12px; width: 300px; padding: 10px;">
                <h2 style="text-align:center; margin:0; font-size:16px;">PEDIDO (NÃO SALVO)</h2>
                <div style="text-align:center; font-size:12px; margin-bottom:10px;">${tipoPedido}</div>
                ${endHtml}
                <hr />
                <strong>ITENS:</strong><br />
                ${itensHtml}
                <hr />
                <div style="text-align:right; font-size:14px;">
                    <div>Subtotal: R$ ${Number(subtotal).toFixed(2)}</div>
                    ${valorTaxa > 0 ? `<div>Taxa: R$ ${Number(valorTaxa).toFixed(2)}</div>` : ''}
                    ${descontoValor > 0 ? `<div>Desconto: -R$ ${Number(descontoValor).toFixed(2)}</div>` : ''}
                    <strong style="font-size: 16px;">TOTAL: R$ ${totalFinal.toFixed(2)}</strong>
                    ${trocoPara > 0 ? `<br /><div>Troco para: R$ ${Number(trocoPara).toFixed(2)}<br />Entregar: R$ ${(Number(trocoPara) - totalFinal).toFixed(2)}</div>` : ''}
                </div>
                ${obs ? `<hr /><div>${obs}</div>` : ''}
                <hr />
                <div style="text-align:center; font-size:10px;">
                    Impresso para conferência - Não fiscal
                </div>
            </div>
        `;
        printHTMLContent(printContent, 'Conferência de Pedido');
    };

    const finalizarPedido = async (dadosComanda) => {
        if (tipoPedido === 'Delivery' && !clienteSelecionado) {
            return alert("Selecione um cliente para Delivery.");
        }

        const totalFinal = dadosComanda?.totalFinal || totalCarrinho;
        let obsFinal = observacaoPedido;

        if (dadosComanda?.trocoPara) {
            const trocoNum = Number(dadosComanda.trocoPara);
            if (trocoNum > totalFinal) {
                const trocoLevar = (trocoNum - totalFinal).toFixed(2);
                const msgTroco = `Troco para R$ ${trocoNum.toFixed(2)} (Enviar R$ ${trocoLevar})`;
                obsFinal = obsFinal ? `${obsFinal} | ${msgTroco}` : msgTroco;
            }
        }

        // Só valida pagamento se NÃO for pagar na entrega
        if (!pagamentoNaEntrega) {
            const totalPago = pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0);
            if (totalPago < (totalFinal - 0.01)) {
                return alert("O total pago é menor que o total do pedido.");
            }
            if (pagamentos.some(p => !p.metodo_pagamento_id)) {
                return alert("Selecione a forma de pagamento para todos os lançamentos.");
            }
        }

        if (carrinho.length === 0) {
            return alert("Carrinho vazio.");
        }

        try {
            const itensParaApi = carrinho.map(item => ({
                produto_id: typeof item.id === 'number' ? item.id : null,
                nome: item.nome,
                valor: item.preco,
                quantidade: item.quantidade || 1,
                observacao: item.observacao || null
            }));

            const payload = {
                tipo: tipoPedido,
                cliente_id: clienteSelecionado?.id || null,
                nome_cliente: nomeCliente || null,
                entregador_id: null,
                observacao: obsFinal || null,
                itens: itensParaApi,
                pagamentos: pagamentoNaEntrega ? [] : pagamentos,
                valor_total: totalFinal,
                desconto: dadosComanda?.descontoValor || 0,
                taxa_servico: dadosComanda?.taxaServico || 0,
                endereco_entrega: enderecoAlternativo.trim() !== ''
                    ? enderecoAlternativo
                    : (clienteSelecionado?.endereco
                        ? `${clienteSelecionado.endereco}${clienteSelecionado.numero ? ', nº ' + clienteSelecionado.numero : ''}`
                        : null),
                complemento_entrega: enderecoAlternativo.trim() !== '' ? complementoAlternativo : (clienteSelecionado?.complemento || null)
            };

            await apiService.criarPedido(payload);
            mostrarMensagem("✅ Pedido realizado com sucesso!");
            
            if (abaAtivaId !== 'novo') {
                await apiService.deletarRascunho(abaAtivaId);
                carregarRascunhos();
            }
            selecionarAba('novo');
        } catch (err) {
            alert("Erro ao enviar pedido.");
        }
    };

    // As variáveis auxiliares foram movidas para cima da função finalizarPedido.

    return (
        <div style={{ padding: '20px', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f4f7f6' }}>

            {/* ABAS DE RASCUNHO */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', overflowX: 'auto', paddingBottom: '5px' }}>
                <div 
                    onClick={() => selecionarAba('novo')}
                    style={{
                        padding: '10px 20px', 
                        background: abaAtivaId === 'novo' ? '#2c3e50' : '#e0e0e0', 
                        color: abaAtivaId === 'novo' ? '#fff' : '#333',
                        borderRadius: '8px 8px 0 0', 
                        cursor: 'pointer', 
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        whiteSpace: 'nowrap'
                    }}
                >
                    + Novo Pedido
                </div>
                {rascunhos.map(r => (
                    <div 
                        key={r.id}
                        onClick={() => selecionarAba(r)}
                        style={{
                            padding: '10px 15px', 
                            background: abaAtivaId === r.id ? '#2c3e50' : '#e0e0e0', 
                            color: abaAtivaId === r.id ? '#fff' : '#333',
                            borderRadius: '8px 8px 0 0', 
                            cursor: 'pointer', 
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <span>{r.identificacao || `Rascunho #${r.id}`}</span>
                        <div 
                            onClick={(e) => fecharAba(r.id, e)}
                            style={{ background: '#e74c3c', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '12px', fontWeight: 'bold' }}
                            title="Descartar rascunho"
                        >✕</div>
                    </div>
                ))}
            </div>

            {/* ÁREA PRINCIPAL DIVIDIDA EM DUAS COLUNAS */}
            <div style={{ display: 'flex', gap: '20px', flex: 1, overflow: 'hidden' }}>

                {/* COLUNA ESQUERDA: Busca de Cliente (se Delivery) + Cardápio (PedidoModulo) */}
                <div style={{ flex: 1.45, display: 'flex', flexDirection: 'column', gap: '15px', overflow: 'hidden' }}>

                    {/* BARRA DE CLIENTE: Agora fica apenas acima do cardápio e não afeta a comanda */}
                    {(tipoPedido === 'Delivery' || tipoPedido === 'Balcão') && (
                        <div style={{ background: '#fff', padding: '18px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', flexShrink: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3 style={{ margin: 0, color: '#2c3e50', borderBottom: 'none', paddingBottom: 0 }}>{tipoPedido === 'Balcão' ? '🚶 Atendimento Balcão' : '🛵 Novo Delivery'}</h3>
                                <button
                                    className="btn-primary"
                                    onClick={() => {
                                        setTipoPedido(tipoPedido === 'Balcão' ? 'Delivery' : 'Balcão');
                                        setClienteSelecionado(null);
                                    }}
                                    style={{ padding: '8px 15px', fontSize: '13px', margin: 0 }}
                                >
                                    MUDAR PARA {tipoPedido === 'Balcão' ? 'DELIVERY' : 'BALCÃO'}
                                </button>
                            </div>
                            {tipoPedido === 'Delivery' ? (
                                <>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#333' }}>Telefone / Nome:</label>
                                        <div style={{ flex: '1 1 200px', position: 'relative' }}>
                                            <input
                                                className="input-busca"
                                                placeholder="Digite o tel. ou nome..."
                                                value={buscaTelefone}
                                                onChange={handleBuscaChange}
                                                style={{ width: '100%', padding: '10px 14px', boxSizing: 'border-box' }}
                                            />
                                            {mostrarDropdownBusca && clientesEncontrados.length > 0 && (
                                                <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: '1px solid #ccc', borderRadius: '4px', zIndex: 100, maxHeight: '250px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                                                    {clientesEncontrados.map(c => (
                                                        <div
                                                            key={c.id}
                                                            onClick={() => { setClienteSelecionado(c); setMostrarDropdownBusca(false); setBuscaTelefone(''); }}
                                                            style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', background: '#fff' }}
                                                            onMouseOver={(e) => e.currentTarget.style.background = '#f4f4f4'}
                                                            onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                                                        >
                                                            <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#2c3e50' }}>{c.nome}</div>
                                                            <div style={{ fontSize: '12px', color: '#e67e22', fontWeight: 'bold' }}>📞 {c.telefone} {c.celular ? `/ ${c.celular}` : ''}</div>
                                                            {c.endereco && <div style={{ fontSize: '11px', color: '#7f8c8d' }}>📍 {c.endereco}, {c.numero} - {c.bairro}</div>}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button className="btn-success" onClick={handleBuscarCliente}>BUSCAR</button>
                                        <button
                                            className="btn-primary"
                                            onClick={() => {
                                                if (clienteSelecionado) {
                                                    mostrarMensagem("Cliente já selecionado. Limpe a busca se quiser cadastrar outro.");
                                                    return;
                                                }
                                                setNovoCliente({
                                                    nome: '', telefone: '', celular: '', CEP: '',
                                                    endereco: '', numero: '', bairro: '', complemento: '', observacao: ''
                                                });
                                                setExibirFormCliente(true);
                                            }}
                                            style={{ padding: '10px 18px' }}
                                        >
                                            + Novo cliente
                                        </button>
                                    </div>
                                    {clienteSelecionado && (
                                        <div style={{ marginTop: '12px', padding: '12px', background: '#e8f5e9', borderRadius: '8px', borderLeft: '4px solid #4caf50' }}>
                                            <div style={{ marginBottom: '8px' }}>
                                                <span style={{ fontWeight: 'bold' }}>{clienteSelecionado.nome}</span>
                                                {clienteSelecionado.endereco && <span> — {clienteSelecionado.endereco}{clienteSelecionado.numero ? ', ' + clienteSelecionado.numero : ''}</span>}
                                            </div>
                                            <div style={{ background: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #c8e6c9', marginTop: '10px' }}>
                                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '4px' }}>Entregar em endereço alternativo? (Opcional)</label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <input
                                                        type="text"
                                                        placeholder="Endereço diferente..."
                                                        value={enderecoAlternativo}
                                                        onChange={(e) => setEnderecoAlternativo(e.target.value)}
                                                        style={{ flex: 2, padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }}
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Complemento..."
                                                        value={complementoAlternativo}
                                                        onChange={(e) => setComplementoAlternativo(e.target.value)}
                                                        style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <label style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>Nome do Cliente:</label>
                                    <input
                                        className="input-busca"
                                        placeholder="Digite o nome para identificar no monitor..."
                                        value={nomeCliente}
                                        onChange={e => setNomeCliente(e.target.value)}
                                        style={{ flex: 1, padding: '10px 14px' }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* CARDÁPIO: Pega o restante do espaço da coluna esquerda */}
                    <div style={{ flex: 1, background: '#fff', borderRadius: '12px', padding: '20px', overflowY: 'auto' }}>
                        <PedidoModulo onAdicionarItem={adicionarAoCarrinho} />
                    </div>
                </div>

                {/* COLUNA DIREITA: Comanda (Sempre intocada na altura) */}
                <div style={{ flex: 1, background: 'var(--dark)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <Comanda
                        titulo={tipoPedido}
                        itens={itensAgrupados}
                        total={totalCarrinho}
                        onRemover={removerDoCarrinho}
                        onFinalizar={finalizarPedido}
                        onImprimir={imprimirPedidoAtual}
                        botaoTexto="CONFIRMAR PEDIDO"
                        desabilitado={(tipoPedido === 'Delivery' && !clienteSelecionado) || carrinho.length === 0}
                    >
                        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #444' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', color: '#fff', cursor: 'pointer' }} onClick={() => setPagamentoNaEntrega(!pagamentoNaEntrega)}>
                                <input
                                    type="checkbox"
                                    checked={pagamentoNaEntrega}
                                    onChange={() => { }} // Handle no onClick do div para maior área de toque
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>🕒 Pagar na entrega / retirada</span>
                            </div>

                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#aaa', display: 'block', marginBottom: '5px' }}>Observação do Pedido (Ex: Precisa de troco):</label>
                                <input
                                    type="text"
                                    placeholder="Troco para R$ 100, etc..."
                                    value={observacaoPedido}
                                    onChange={e => setObservacaoPedido(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #555', background: '#333', color: '#fff' }}
                                />
                            </div>

                            {!pagamentoNaEntrega && (
                                <MultiPagamento
                                    metodos={metodosPagamento}
                                    totalPedido={totalCarrinho}
                                    tipoPedido={tipoPedido}
                                    onChange={setPagamentos}
                                />
                            )}
                        </div>
                    </Comanda>
                </div>
            </div>

            {/* MODAL DE CADASTRO DE CLIENTE */}
            {exibirFormCliente && (
                <div style={styles.overlay}>
                    <div style={styles.modalCliente}>
                        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Cadastrar novo cliente</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <input placeholder="Nome *" className="input-busca" style={{ gridColumn: 'span 2' }} value={novoCliente.nome} onChange={e => setNovoCliente({ ...novoCliente, nome: e.target.value })} />
                            <input placeholder="Telefone *" className="input-busca" value={novoCliente.telefone} onChange={e => setNovoCliente({ ...novoCliente, telefone: mascararTelefone(e.target.value) })} />
                            <input placeholder="Celular" className="input-busca" value={novoCliente.celular} onChange={e => setNovoCliente({ ...novoCliente, celular: mascararCelular(e.target.value) })} />
                            <input placeholder="CEP" className="input-busca" value={novoCliente.CEP} onBlur={handleCepBlur} onChange={e => setNovoCliente({ ...novoCliente, CEP: mascararCEP(e.target.value) })} />
                            <input placeholder="Bairro" className="input-busca" value={novoCliente.bairro} onChange={e => setNovoCliente({ ...novoCliente, bairro: e.target.value })} />
                            <input placeholder="Rua / Endereço *" className="input-busca" style={{ gridColumn: 'span 2' }} value={novoCliente.endereco} onChange={e => setNovoCliente({ ...novoCliente, endereco: e.target.value })} />
                            <input placeholder="Número" className="input-busca" value={novoCliente.numero} onChange={e => setNovoCliente({ ...novoCliente, numero: e.target.value })} />
                            <input placeholder="Complemento" className="input-busca" value={novoCliente.complemento} onChange={e => setNovoCliente({ ...novoCliente, complemento: e.target.value })} />
                            <input placeholder="Observação" className="input-busca" style={{ gridColumn: 'span 2' }} value={novoCliente.observacao} onChange={e => setNovoCliente({ ...novoCliente, observacao: e.target.value })} />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                            <button className="btn-success" style={{ flex: 1 }} onClick={handleSalvarCliente}>SALVAR</button>
                            <button className="btn-danger" style={{ flex: 1 }} onClick={() => setExibirFormCliente(false)}>CANCELAR</button>
                        </div>
                    </div>
                </div>
            )}

            {mensagem && <div style={styles.toast}>{mensagem}</div>}
        </div>
    );
};

const styles = {
    overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
    modalCliente: { background: '#fff', padding: '30px', borderRadius: '15px', width: '520px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' },
    toast: { position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#333', color: '#fff', padding: '10px 20px', borderRadius: '50px', zIndex: 3000 }
};

export default PedidoNovo;