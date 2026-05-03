// src/utils/productFilters.js

export const CATEGORIES = {
    PIZZA: 'pizza'
};

/**
 * Filtra produtos baseados na busca e se é modo pizza ou não.
 * Normaliza strings para evitar erros de Case Sensitivity.
 */
export const filtrarProdutos = (produtos, termoBusca, mostrarApenasPizza) => {
    const termo = termoBusca.toLowerCase();
    
    return produtos.filter(p => {
        const categoria = p.categoria ? p.categoria.toLowerCase() : '';
        const nome = p.nome ? p.nome.toLowerCase() : '';
        const idString = p.id ? String(p.id) : '';
        const bateBusca = nome.includes(termo) || idString.includes(termo);

        if (mostrarApenasPizza) {
            return categoria === CATEGORIES.PIZZA && bateBusca;
        } else {
            return categoria !== CATEGORIES.PIZZA && bateBusca;
        }
    });
};

/**
 * Calcula o preço da pizza baseado no modo configurado:
 * 'maior' = maior preço entre sabores (padrão)
 * 'media' = média dos preços
 */
export const calcularPrecoPizza = (sabores, tamanho, modo = 'maior') => {
    if (sabores.length === 0) return 0;
    
    const precos = sabores.map(s => 
        tamanho === 'Média' ? (s.preco_broto || s.preco) : s.preco
    );
    
    if (modo === 'media') {
        return precos.reduce((a, b) => a + b, 0) / precos.length;
    }
    return Math.max(...precos);
};

/**
 * Agrupa itens idênticos do carrinho/comanda para não repetir linhas.
 * Diferencia pizzas de tamanhos ou sabores diferentes.
 */
export const agruparItens = (itens) => {
    if (!itens) return [];
    
    return itens.reduce((acc, item) => {
        const idItem = item.produto_id || item.id;
        const valorItem = item.valor || item.preco || 0;

        const existe = acc.find(i => {
            const idI = i.produto_id || i.id;
            const valorI = i.valor || i.preco || 0;
            return idI === idItem && 
                   i.nome === item.nome && 
                   valorI === valorItem &&
                   i.observacao === item.observacao;
        });

        if (existe) {
            existe.quantidade += item.quantidade;
            existe.valor_total_item = existe.quantidade * valorItem;
        } else {
            acc.push({ 
                ...item, 
                valor_total_item: item.quantidade * valorItem 
            });
        }
        return acc;
    }, []);
};


export const formatarMoeda = (valor) => {
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// --- MÁSCARAS ---
export const mascararCEP = (v) => {
    v = (v || "").replace(/\D/g, "");
    if (v.length > 8) v = v.substring(0, 8);
    return v.replace(/(\d{5})(\d)/, "$1-$2");
};

export const mascararTelefone = (v) => {
    v = (v || "").replace(/\D/g, "");
    if (v.length > 11) v = v.substring(0, 11);
    if (v.length > 10) {
        return v.replace(/(\d{2})(\d{5})(\d{4})/, "$1-$2-$3");
    }
    return v.replace(/(\d{2})(\d{4})(\d{4})/, "$1-$2-$3");
};

export const mascararCelular = (v) => {
    v = (v || "").replace(/\D/g, "");
    if (v.length > 12) v = v.substring(0, 12);
    if (v.length >= 12) {
        return v.replace(/(\d{2})(\d{6})(\d{4})/, "$1-$2-$3");
    }
    // Fallback para o padrão telefone se tiver menos dígitos
    return mascararTelefone(v);
};