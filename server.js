// =========================================
// SERVER.JS - Serveur sécurisé
// Inclut : validation Telegram, rate limiting, helmet
// =========================================

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');     // Intégré dans Node.js (pas besoin d'installer)
const helmet = require('helmet');     // Headers de sécurité HTTP
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// =========================================
// CONFIGURATION DE L'APPLICATION
// =========================================

const app = express();
const PORT = process.env.PORT || 3000;

// =========================================
// SÉCURITÉ 1 : HELMET — Headers HTTP sécurisés
// Protège contre XSS, clickjacking, etc.
// =========================================
app.use(helmet({
    // On désactive contentSecurityPolicy pour ne pas bloquer le SDK Telegram
    contentSecurityPolicy: false
}));

// =========================================
// SÉCURITÉ 2 : RATE LIMITING — Limite les requêtes
// Max 100 requêtes toutes les 15 minutes par IP
// Empêche les attaques par force brute
// =========================================
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // Fenêtre de 15 minutes
    max: 100,                   // Max 100 requêtes par IP par fenêtre
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de requêtes. Réessaie dans 15 minutes.' }
});

// Applique le rate limit uniquement aux routes API
app.use('/api/', limiter);

// =========================================
// MIDDLEWARES DE BASE
// =========================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =========================================
// CONNEXION À POSTGRESQL
// =========================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && (
        process.env.DATABASE_URL.includes('sslmode=require') ||
        process.env.DATABASE_URL.includes('neon.tech') ||
        process.env.DATABASE_URL.includes('render.com')
    )
        ? { rejectUnauthorized: false }
        : false
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Erreur de connexion à PostgreSQL:', err.message);
    } else {
        console.log('✅ Connecté à PostgreSQL:', res.rows[0].now);
    }
});

// =========================================
// SÉCURITÉ 3 : VALIDATION TELEGRAM INITDATA
//
// Telegram signe chaque session utilisateur avec ton bot token.
// Cette fonction vérifie que la signature est authentique.
// Si quelqu'un essaie de forger un faux user ID → requête rejetée.
//
// Documentation officielle :
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// =========================================

/**
 * Valide l'initData envoyé par Telegram.
 * @param {string} initData - La chaîne initData du WebApp Telegram
 * @returns {{ valid: boolean, user: object|null }}
 */
function validateTelegramInitData(initData) {
    // Si pas de BOT_TOKEN configuré → mode développement local
    if (!process.env.BOT_TOKEN) {
        console.warn('⚠️  BOT_TOKEN non défini — validation Telegram désactivée (mode dev)');
        return { valid: true, user: null };
    }

    // Si pas de initData → requête non autorisée
    if (!initData || initData.trim() === '') {
        return { valid: false, user: null };
    }

    try {
        // Étape 1 : Séparer les paramètres de l'initData
        const urlParams = new URLSearchParams(initData);

        // Étape 2 : Extraire et supprimer le hash (c'est la signature à vérifier)
        const receivedHash = urlParams.get('hash');
        if (!receivedHash) return { valid: false, user: null };
        urlParams.delete('hash');

        // Étape 3 : Trier les paramètres et les joindre avec '\n'
        const dataCheckString = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        // Étape 4 : Créer la clé secrète = HMAC-SHA256("WebAppData", bot_token)
        const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(process.env.BOT_TOKEN)
            .digest();

        // Étape 5 : Calculer le hash attendu
        const computedHash = crypto
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        // Étape 6 : Comparer les deux hash (timing-safe pour éviter les timing attacks)
        const isValid = crypto.timingSafeEqual(
            Buffer.from(computedHash, 'hex'),
            Buffer.from(receivedHash, 'hex')
        );

        if (!isValid) return { valid: false, user: null };

        // Étape 7 : Extraire les données utilisateur
        const userParam = urlParams.get('user');
        const user = userParam ? JSON.parse(decodeURIComponent(userParam)) : null;

        // Étape 8 : Vérifier que les données ne sont pas trop vieilles (max 1 heure)
        const authDate = parseInt(urlParams.get('auth_date') || '0', 10);
        const now = Math.floor(Date.now() / 1000);
        if (now - authDate > 3600) {
            console.warn('⚠️  initData périmé (plus d\'1 heure)');
            return { valid: false, user: null };
        }

        return { valid: true, user };

    } catch (err) {
        console.error('Erreur validation initData:', err.message);
        return { valid: false, user: null };
    }
}

// =========================================
// MIDDLEWARE D'AUTHENTIFICATION
// S'applique à toutes les routes /api/
// Valide l'identité Telegram avant chaque requête
// =========================================
function telegramAuthMiddleware(req, res, next) {
    const initData = req.headers['x-telegram-init-data'];

    // Mode développement local : pas de BOT_TOKEN configuré
    if (!process.env.BOT_TOKEN) {
        // Utilise l'ID du header en fallback (mode dev uniquement)
        req.telegramUserId = req.headers['x-telegram-user-id'] || 'dev-user';
        return next();
    }

    const { valid, user } = validateTelegramInitData(initData);

    if (!valid) {
        return res.status(401).json({
            error: 'Authentification Telegram invalide. Ouvre l\'app depuis Telegram.'
        });
    }

    // Attache l'ID Telegram vérifié à la requête
    if (user) {
        req.telegramUserId = user.id.toString();
        req.telegramUser = user;
    } else {
        // BOT_TOKEN défini mais pas de user (ne devrait pas arriver)
        req.telegramUserId = req.headers['x-telegram-user-id'];
    }

    next();
}

// Applique le middleware d'auth à toutes les routes API
app.use('/api/', telegramAuthMiddleware);

// =========================================
// INITIALISATION DE LA BASE DE DONNÉES
// =========================================
async function initDatabase() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            telegram_user_id BIGINT NOT NULL,
            type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
            amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
            category VARCHAR(100) NOT NULL,
            description TEXT,
            date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_transactions_telegram_user_id ON transactions(telegram_user_id);
    `;
    try {
        await pool.query(createTableQuery);
        console.log('✅ Table "transactions" prête');
    } catch (err) {
        console.error('❌ Erreur initialisation base de données:', err.message);
    }
}

// =========================================
// ROUTES API
// (req.telegramUserId est dispo grâce au middleware)
// =========================================

// GET /api/transactions — Toutes les transactions de l'utilisateur
app.get('/api/transactions', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM transactions WHERE telegram_user_id = $1 ORDER BY date DESC, created_at DESC',
            [req.telegramUserId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Erreur GET /api/transactions:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/transactions — Ajouter une transaction
app.post('/api/transactions', async (req, res) => {
    const { type, amount, category, description, date } = req.body;

    // Validation
    if (!type || !amount || !category || !date) {
        return res.status(400).json({ error: 'Champs obligatoires manquants : type, montant, catégorie, date' });
    }
    if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ error: 'Le type doit être "income" ou "expense"' });
    }
    if (isNaN(amount) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: 'Le montant doit être un nombre positif' });
    }
    // Validation de la date
    if (isNaN(new Date(date).getTime())) {
        return res.status(400).json({ error: 'Date invalide' });
    }
    // Limite la longueur de la description pour éviter les injections longues
    if (description && description.length > 500) {
        return res.status(400).json({ error: 'Description trop longue (max 500 caractères)' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO transactions (telegram_user_id, type, amount, category, description, date)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [req.telegramUserId, type, parseFloat(amount), category, description || '', date]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Erreur POST /api/transactions:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/transactions/:id — Supprimer une transaction
app.delete('/api/transactions/:id', async (req, res) => {
    const { id } = req.params;

    // Vérifie que l'id est bien un nombre (évite les injections SQL)
    if (isNaN(parseInt(id, 10))) {
        return res.status(400).json({ error: 'ID invalide' });
    }

    try {
        const result = await pool.query(
            'DELETE FROM transactions WHERE id = $1 AND telegram_user_id = $2 RETURNING *',
            [id, req.telegramUserId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Transaction non trouvée ou non autorisée' });
        }
        res.json({ message: 'Transaction supprimée', transaction: result.rows[0] });
    } catch (err) {
        console.error('Erreur DELETE /api/transactions:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/summary — Résumé financier
app.get('/api/summary', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS "totalIncome",
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS "totalExpenses"
             FROM transactions
             WHERE telegram_user_id = $1`,
            [req.telegramUserId]
        );
        const { totalIncome, totalExpenses } = result.rows[0];
        res.json({
            totalIncome: parseFloat(totalIncome),
            totalExpenses: parseFloat(totalExpenses),
            balance: parseFloat(totalIncome) - parseFloat(totalExpenses)
        });
    } catch (err) {
        console.error('Erreur GET /api/summary:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/categories-summary — Dépenses par catégorie
app.get('/api/categories-summary', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT category, SUM(amount) AS total
             FROM transactions
             WHERE telegram_user_id = $1 AND type = 'expense'
             GROUP BY category
             ORDER BY total DESC`,
            [req.telegramUserId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Erreur GET /api/categories-summary:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Health check (pas de auth middleware ici, Render en a besoin)
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Budget Planner API en ligne' });
});

// =========================================
// DÉMARRAGE DU SERVEUR
// =========================================
async function startServer() {
    await initDatabase();
    app.listen(PORT, () => {
        console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
        console.log(`🔒 Sécurité : Helmet ✅  Rate Limit ✅  Telegram Auth: ${process.env.BOT_TOKEN ? '✅' : '⚠️  désactivée (BOT_TOKEN manquant)'}`);
    });
}

startServer();
