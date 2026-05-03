import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import {BACKEND_BASE_URL } from '../constants/apiConstants';

const PizzariaConfigForm = ({ setMessage }) => {
    const [config, setConfig] = useState({
        nome_pizzaria: '',
        cnpj: '',
        rua: '',
        bairro: '',
        cidade: '',
        estado: '',
        logo_url: ''
    });

    useEffect(() => {
        const load = async () => {
            try {
                const res = await apiService.getConfiguracoes();
                if (res.data.data) setConfig(prev => ({ ...prev, ...res.data.data }));
            } catch (err) { console.error(err); }
        };
        load();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            await apiService.updateConfiguracoes(config);
            setMessage('Dados salvos com sucesso!');
        } catch (err) { setMessage('Erro ao salvar dados.'); }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('logo', file);

        try {
            const res = await apiService.uploadLogo(formData);
            setConfig(prev => ({ ...prev, logo_url: res.data.logoUrl }));
            setMessage('Logo atualizado!');
        } catch (err) { setMessage('Erro no upload.'); }
    };

    return (
        <div className="config-form-container">
            <form onSubmit={handleSave} className="grid-form">
                <section>
                    <h3>Dados Principais</h3>
                    <input name="nome_pizzaria" placeholder="Nome da Pizzaria" value={config.nome_pizzaria || ''} onChange={handleChange} />
                    <input name="cnpj" placeholder="CNPJ" value={config.cnpj || ''} onChange={handleChange} />
                </section>

                <section>
                    <h3>Endereço</h3>
                    <input name="rua" placeholder="Rua e Número" value={config.rua || ''} onChange={handleChange} />
                    <div className="form-row">
                        <input name="bairro" placeholder="Bairro" value={config.bairro || ''} onChange={handleChange} />
                        <input name="cidade" placeholder="Cidade" value={config.cidade || ''} onChange={handleChange} />
                        <input name="estado" placeholder="UF" style={{width: '60px'}} value={config.estado || ''} onChange={handleChange} />
                    </div>
                </section>

                <section className="logo-section">
                    <h3>Logo da Empresa</h3>
                    <input type="file" onChange={handleLogoUpload} accept="image/*" />
                    {config.logo_url && (
                        <div className="logo-preview">
                            <img src={`${BACKEND_BASE_URL}${config.logo_url}`} alt="Logo" style={{width: '250px'}} />
                        </div>
                    )}
                </section>

                <button type="submit" className="btn-save">Salvar Tudo</button>
            </form>
        </div>
    );
};

export default PizzariaConfigForm;