import React from 'react';

const SeletorPagamento = ({ metodos, selecionado, onSelecionar }) => {
    return (
        <div className="pagamento-container">
            <label style={{ fontSize: '12px', color: '#bdc3c7', fontWeight: 'bold' }}>FORMA DE PAGAMENTO</label>
            <div className="pagamento-grid">
                {metodos.map((metodo) => (
                    <button
                        key={metodo.id}
                        type="button"
                        className={`btn-pagamento ${selecionado === metodo.id ? 'active' : ''}`}
                        onClick={() => onSelecionar(metodo.id)}
                    >
                        {metodo.nome.toUpperCase()}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default SeletorPagamento;