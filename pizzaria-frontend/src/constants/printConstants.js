// src/constants/printConstants.js

export const allPrintableElements = [
    { key: 'header', label: 'Cabeçalho da Pizzaria', isStatic: true },
    { key: 'num_pedido', label: 'Número do Pedido', isToggleable: true, configKey: 'show_num_pedido' },
    { key: 'dados_cliente', label: 'Dados do Cliente/Endereço', isToggleable: true, configKey: 'show_dados_cliente' },
    { key: 'itens_pedido', label: 'Itens da Comanda/Pedido', isToggleable: true, configKey: 'show_itens_pedido' },
    { key: 'valor_itens', label: 'Valores Individuais dos Itens', isToggleable: true, configKey: 'show_valor_itens' },
    { key: 'valor_total', label: 'Valor Total do Pedido', isToggleable: true, configKey: 'show_valor_total' },
    { key: 'modo_pagamento', label: 'Modo de Pagamento', isToggleable: true, configKey: 'show_modo_pagamento' },
    { key: 'observacao', label: 'Observações do Pedido', isToggleable: true, configKey: 'show_observacao' },
    { key: 'footer', label: 'Rodapé (Agradecimento)', isStatic: true },
];

export const defaultPrintOrderKeys = allPrintableElements.map(e => e.key);

export const STATUS_COLUMNS = {
    'Pendente': { label: '🆕 Novos Pedidos', nextStatus: 'Preparando', prevStatus: null },
    'Preparando': { label: '🔪 Em Preparação', nextStatus: 'Pronto para Entrega/Retirada', prevStatus: 'Pendente' },
    'Pronto para Entrega/Retirada': { label: '✅ Pronto p/ Envio', nextStatus: 'Entregue/Concluído', prevStatus: 'Preparando' },
    //'Entregue/Concluído': { label: '🎉 Concluídos (Hoje)', nextStatus: null, prevStatus: 'Pronto para Entrega/Retirada' },
};