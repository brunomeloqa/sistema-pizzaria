export const printHTMLContent = (htmlContent, title = 'Documento') => {
    // 1. Abre uma nova janela/pop-up
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("O bloqueador de pop-ups impediu a impressão. Por favor, permita pop-ups para imprimir.");
        return;
    }
    
    // 2. Cria o HTML básico com estilos de impressão
    printWindow.document.write(`
        <html>
            <head>
                <title>${title}</title>
                <style>
                    /* Reset básico para impressão de comandas/recibos */
                    body { margin: 0; padding: 0; width: 300px; font-family: monospace; }
                    .print-container { 
                        width: 100%; 
                        max-width: 300px; /* Garante que caiba em recibos */
                        padding: 10px; 
                        font-size: 12px; 
                        box-sizing: border-box; 
                    }
                    /* Opcional: Estilos para esconder cabeçalhos/rodapés padrão do navegador */
                    @page { margin: 0.5cm; } 
                </style>
            </head>
            <body>
                <div class="print-container">
                    ${htmlContent}
                </div>
                <script>
                    // Espera o conteúdo carregar antes de imprimir
                    window.onload = function() {
                        window.print();
                        window.close();
                    };
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
};