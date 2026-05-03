/**
 * Retorna um objeto Date do JavaScript com o horário de São Paulo (GMT-3).
 */
function getNowSP() {
    // Retorna a data considerando o fuso de SP
    const date = new Date();
    return new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

/**
 * Retorna a data/hora atual formatada para o padrão do banco (YYYY-MM-DD HH:MM:SS)
 * garantindo o fuso horário de São Paulo (GMT-3).
 */
function getAgoraSP() {
    // Formato sv-SE gera algo como "2023-10-27 15:30:00" quando usado com replace
    return new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace('T', ' ');
}

module.exports = { getAgoraSP, getNowSP };
