// src/components/MesaAdmin.js
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

const MesaAdmin = () => {
    const [mesas, setMesas] = useState([]);
    const [numero, setNumero] = useState('');

    const carregarMesas = async () => {
        const res = await apiService.listarMesas(); // Criar esta rota no api.js
        setMesas(res.data.data);
    };

    useEffect(() => { carregarMesas(); }, []);

    const handleAddMesa = async (e) => {
        e.preventDefault();
        try {
            await apiService.criarMesa({ numero: parseInt(numero) });
            setNumero('');
            carregarMesas();
        } catch (err) { alert("Mesa já existe ou erro no servidor."); }
    };

    return (
        <div style={{ padding: '20px' }}>
            <h3>🏗️ Cadastro de Mesas</h3>
            <form onSubmit={handleAddMesa} style={{ marginBottom: '20px' }}>
                <input 
                    type="number" 
                    placeholder="Número da Mesa" 
                    value={numero} 
                    onChange={e => setNumero(e.target.value)} 
                    required 
                    style={{ padding: '8px', marginRight: '10px' }}
                />
                <button type="submit" style={{ padding: '8px 15px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px' }}>
                    ADICIONAR MESA
                </button>
            </form>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '15px' }}>
                {mesas.map(m => (
                    <div key={m.id} style={{ padding: '15px', border: '1px solid #ccc', textAlign: 'center', borderRadius: '8px', background: '#f9f9f9' }}>
                        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>Mesa {m.numero}</div>
                        <button onClick={() => apiService.deletarMesa(m.id).then(carregarMesas)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer', marginTop: '10px' }}>Excluir</button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MesaAdmin;