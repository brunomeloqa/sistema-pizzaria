// src/pages/DeliveryNovo.js
import PedidoModulo from '../components/PedidoModulo';

const DeliveryNovo = () => {
    const [cliente, setCliente] = useState({ nome: '', endereco: '' });

    const finalizarVendaDireta = async (itens, total) => {
        // Lógica específica: criar pedido e já lançar no caixa
        await apiService.criarVendaDireta({ cliente, itens, total });
        alert("Venda de Delivery finalizada!");
    };

    return (
        <div>
            <input placeholder="Nome do Cliente" onChange={e => setCliente({...cliente, nome: e.target.value})} />
            <PedidoModulo 
                tipo="Delivery" 
                onFinalizar={finalizarVendaDireta} 
            />
        </div>
    );
};