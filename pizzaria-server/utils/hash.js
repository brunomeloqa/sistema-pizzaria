// utils/hash.js
const bcrypt = require('bcryptjs');

const saltRounds = 10;

/**
 * Cria o hash de uma senha.
 * @param {string} password - Senha em texto simples.
 * @returns {Promise<string>} O hash da senha.
 */
function hashPassword(password) {
    return bcrypt.hash(password, saltRounds);
}

/**
 * Compara uma senha em texto simples com um hash.
 * @param {string} password - Senha em texto simples.
 * @param {string} hash - Hash armazenado no DB.
 * @returns {Promise<boolean>} True se as senhas coincidirem.
 */
function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
}

module.exports = {
    hashPassword,
    comparePassword,
};