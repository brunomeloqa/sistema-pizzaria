// middleware/auth.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'Qc8yH#5g9Kz@r!vLx$2nB&pTfWuJmZdE4aR7s6I1tA9o0';

function ensureAuthenticated(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && (authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader);

    if (!token) return res.status(401).json({ error: 'Token não fornecido.' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Sessão expirada.' });
    }
}

function ensureAdmin(req, res, next) {
    ensureAuthenticated(req, res, () => {
        if (req.user && req.user.role === 'admin') {
            next();
        } else {
            res.status(403).json({ error: 'Acesso negado. Requer admin.' });
        }
    });
}

module.exports = { ensureAuthenticated, ensureAdmin };