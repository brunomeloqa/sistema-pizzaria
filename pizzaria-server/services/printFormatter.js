// backend/services/printFormatter.js
const { db } = require('../database');
const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;
const path = require('path');

async function formatarPedidoParaImpressao(pedido, config, layoutType = 'geral') {
    const { footer_message, nome_pizzaria, endereco, print_font_size, logo_url } = config;
    
    // Define qual ordem usar com base no layoutType solicitado
    let print_order = config.print_order; // padrão
    if (layoutType === 'cozinha' && config.print_order_cozinha) {
        print_order = config.print_order_cozinha;
    } else if (layoutType === 'entregador' && config.print_order_entregador) {
        print_order = config.print_order_entregador;
    }

    const ordem = typeof print_order === 'string' ? print_order.split(',') : print_order;

    let printer = new ThermalPrinter({
      type: PrinterTypes.EPSON, // Generico ESC/POS
      interface: 'none', // Nós geramos o JS Buffer e enviamos nós mesmos
      characterSet: 'PC860_PORTUGUESE', // Caracteres portugueses
      removeSpecialCharacters: false,
      lineCharacter: "-",
      options: {
        timeout: 5000
      }
    });

    if (print_font_size === 'Expandida' || print_font_size === 'Grande') {
        printer.setTextDoubleHeight();
        printer.setTextDoubleWidth();
    } else {
        printer.setTextNormal();
    }

    printer.alignCenter();

    // Imprime a Logo (Se for entrega e tiver configurado)
    if (logo_url && layoutType !== 'cozinha') {
        try {
            const cleanUrl = logo_url.replace(/^\//, ''); // Remove a / inicial se tiver
            const logoPath = path.join(__dirname, '..', cleanUrl);
            await printer.printImage(logoPath);
        } catch (e) {
            console.error('[PrintFormatter] Nao foi possivel carregar o logo termico:', e.message);
        }
    }

    printer.println(nome_pizzaria.toUpperCase());
    printer.println(endereco || '');
    printer.drawLine();
    
    printer.alignLeft();

    // Blocos dinâmicos baseados na ordem do banco
    ordem.forEach(item => {
        if (config[`show_${item}`] === 0) return;

        switch (item) {
            case 'num_pedido':
                if (print_font_size !== 'Expandida') {
                    printer.setTextDoubleHeight(); printer.setTextDoubleWidth();
                }
                printer.println(`PEDIDO: #${pedido.id}`);
                printer.setTextNormal();
                break;
            case 'dados_cliente':
                printer.println(`CLIENTE: ${pedido.cliente_nome || 'Consumidor'}`);
                printer.println(`TEL: ${pedido.cliente_telefone || 'N/A'}`);
                if(pedido.endereco_entrega) printer.println(`END: ${pedido.endereco_entrega}`);
                if(pedido.complemento_entrega) printer.println(`COMPL.: ${pedido.complemento_entrega}`);
                break;
            case 'itens_pedido':
                pedido.itens.forEach(i => {
                    printer.println(`${i.quantidade}x ${i.nome}`);
                    if(i.observacao) {
                        printer.println(`   Obs: ${i.observacao}`);
                    }
                    if(layoutType !== 'cozinha' && config.show_valor_itens) {
                        printer.println(`   un. R$ ${i.valor.toFixed(2)}`);
                    }
                });
                break;
            case 'valor_total':
                printer.println(`TOTAL: R$ ${pedido.valor_total.toFixed(2)}`);
                break;
            case 'modo_pagamento':
                printer.println(`PAGTO: ${pedido.forma_pagamento || ''}`);
                break;
            case 'observacao':
                if(pedido.observacao) printer.println(`OBS GERAL: ${pedido.observacao}`);
                break;
        }
    });

    // Footer fixo
    printer.drawLine();
    printer.alignCenter();
    if (layoutType !== 'cozinha' && footer_message) printer.println(footer_message);
    
    // Sempre corta o papel na impressora termica no fim do ticket
    printer.cut();
    
    // Para resolver o problema de ficar preso, damos um avanço extra e um trigger de beep opcional
    printer.beep();
    
    const buffer = printer.getBuffer();
    return buffer;
}

module.exports = { formatarPedidoParaImpressao };