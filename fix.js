const { db } = require("./pizzaria-server/database");

const database = db();
database.run(
  "UPDATE Pedido SET status = 'Entregue/Concluído' WHERE mesa_id IS NOT NULL AND status NOT IN ('Finalizado', 'Entregue/Concluído', 'Cancelado', 'Aberto')",
  [],
  (err) => {
    if (err) console.error(err);
    else console.log("Done");
  }
);
