// printQueue.js

const db = require('./database').db(); // Conexão com SQLite
const queue = []; // A fila que armazena os IDs dos pedidos
let isProcessing = false; // Flag para garantir que apenas um pedido seja processado por vez
const { formatarPedidoParaImpressao } = require('./services/printFormatter');
const { enviarParaImpressora } = require('./services/printExecutor');
const fs = require('fs');
const path = require('path');

/**
 * Envia o buffer puro para a impressora usando ferramentas do SO.
 */
async function printJob(pedido) {
    console.log(`\n======================================================`);
    console.log(`IMPRIMINDO PEDIDO #${pedido.id} - ${pedido.status}`);

    try {
        const config = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM Configuracoes WHERE id = 1", [], (err, row) => {
                if (err) reject(err); else resolve(row);
            });
        });

        if (!config || !config.impressora_caminho) {
            console.error('[Print Queue] Configuração da impressora não encontrada.');
            return;
        }

        // Gera vias diferentes caso o pedido seja delivery ou mesa/balcão
        const layoutType = pedido.tipo === 'Entrega' ? 'entregador' : 'cozinha';
        
        // Gera o buffer ESC/POS
        const buffer = await formatarPedidoParaImpressao(pedido, config, layoutType);

        // Define arquivo temporário no diretório temp do SO
        const os = require('os');
        const tempFile = path.join(os.tmpdir(), `cupom_${pedido.id}.bin`);
        fs.writeFileSync(tempFile, buffer);

        try {
            await enviarParaImpressora(tempFile, config.impressora_caminho);
            console.log('[Print Queue] Impresso com sucesso.');
        } catch (printErr) {
            console.error('[Print Queue] Erro ao enviar para impressora:', printErr.message);
        } finally {
            try {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
            } catch (e) {}
        }

    } catch (e) {
        console.error('[Print Queue] Erro na geração da impressão:', e.message);
    }
    console.log(`======================================================\n`);
}

/**
 * Worker: Processa o próximo item na fila.
 */
async function processQueue() {
    if (isProcessing || queue.length === 0) {
        return; 
    }
    
    isProcessing = true;
    const pedidoId = queue.shift(); 

    try {
        const pedidoSql = `
            SELECT p.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone, c.endereco AS cliente_endereco
            FROM Pedido p LEFT JOIN Cliente c ON p.cliente_id = c.id WHERE p.id = ?
        `;
        
        db.get(pedidoSql, [pedidoId], (err, pedido) => {
            if (err || !pedido) {
                console.error(`[Print Queue] Erro ao buscar Pedido #${pedidoId}`);
                isProcessing = false;
                process.nextTick(processQueue);
                return;
            }

            const itensSql = `
                SELECT ip.quantidade, ip.observacao, pr.nome AS nome, pr.preco AS valor
                FROM ItemPedido ip JOIN Produto pr ON ip.produto_id = pr.id WHERE ip.pedido_id = ?
            `;
            
            db.all(itensSql, [pedidoId], async (itemErr, itens) => {
                if (itemErr) {
                    console.error(`[Print Queue] Erro ao buscar itens`);
                    isProcessing = false;
                    process.nextTick(processQueue);
                    return;
                }

                pedido.itens = itens;
                
                await printJob(pedido);

                isProcessing = false;
                process.nextTick(processQueue);
            });
        });
        
    } catch (e) {
        console.error("[Print Queue] Erro geral no processamento:", e.message);
        isProcessing = false;
        process.nextTick(processQueue);
    }
}

/**
 * Adiciona um novo trabalho de impressão à fila.
 * @param {number} pedidoId - O ID do pedido recém-criado.
 */
function addJob(pedidoId) {
    if (pedidoId) {
        queue.push(pedidoId);
        console.log(`[Print Queue] Pedido #${pedidoId} adicionado à fila. Tamanho da fila: ${queue.length}`);
        // Tenta iniciar o processamento imediatamente
        process.nextTick(processQueue);
    }
}

// Exporta a função para ser usada pela rota de pedidos
module.exports = { addJob };