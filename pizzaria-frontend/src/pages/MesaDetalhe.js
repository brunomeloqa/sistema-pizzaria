// src/pages/MesaDetalhe.js
import PedidoModulo from '../components/PedidoModulo';

const MesaDetalhe = ({ mesaId }) => {
    const salvarPedidoMesa = async (itens, total) => {
        // Lógica específica: salvar e manter mesa aberta
        await apiService.adicionarItensMesa({ mesa_id: mesaId, itens, total });
        alert("Itens adicionados à mesa!");
    };

    return (
        <PedidoModulo 
            tipo="Mesa" 
            metaDados={{ identificador: mesaId }} 
            onFinalizar={salvarPedidoMesa} 
        />
    );
};