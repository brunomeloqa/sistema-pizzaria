const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./pizzaria.db'); // Assumindo que seu DB se chama pizzaria.db

const produtosParaInserir = [
    { nome: 'Pizza Mussarela Média', preco: 45.00, descricao: 'Massa tradicional, molho de tomate, queijo mussarela e orégano.', categoria: 'Pizza' },
    { nome: 'Coca-Cola 2L', preco: 9.55, descricao: 'Refrigerante Coca-Cola de 2 Litros. Entregue gelada.', categoria: 'Bebida' },
    { nome: 'Adicional Bacon', preco: 1.50, descricao: 'Adicional de Bacon em cubos. Aplicável em metade da pizza (meia pizza).', categoria: 'Adicional' },
];

db.serialize(() => {
    console.log("Iniciando a inserção de produtos de exemplo...");

    // Verifica se a tabela Produto já existe e a limpa (Opcional, mas útil para testes)
    // Se você não quer apagar os produtos existentes, comente a linha abaixo.
    // db.run("DELETE FROM Produto"); 

    const stmt = db.prepare("INSERT INTO Produto (nome, preco, descricao, categoria) VALUES (?, ?, ?, ?)");

    let count = 0;
    produtosParaInserir.forEach(produto => {
        stmt.run(
            produto.nome, 
            produto.preco, 
            produto.descricao, 
            produto.categoria,
            function(err) {
                if (err) {
                    // O erro mais comum aqui é 'UNIQUE constraint failed' se você tentar inserir duas vezes
                    console.error(`Erro ao inserir ${produto.nome}: ${err.message}`);
                } else {
                    count++;
                }
            }
        );
    });

    stmt.finalize(() => {
        console.log(`\n✅ ${count} produtos inseridos com sucesso.`);
        console.log("Tabela Produto atualizada.");
        db.close();
    });
});