// =========================================
// SERVER.JS - Le cœur de notre application
// Ce fichier démarre le serveur et définit toutes les routes API
// =========================================

// Chargement des modules nécessaires
const express = require('express');   // Framework web
const { Pool } = require('pg');       // Client PostgreSQL
const cors = require('cors');         // Permet les requêtes cross-origin
const path = require('path');         // Gestion des chemins de fichiers
require('dotenv').config();           // Chargement des variables d'environnement depuis .env

// =========================================
// CONFIGURATION DE L'APPLICATION
// =========================================

// Création de l'application Express
const app = express();

// Port d'écoute : utilise PORT de l'environnement (Render) ou 3000 en local
const PORT = process.env.PORT || 3000;

// =========================================
// MIDDLEWARES (traitements appliqués à chaque requête)
// =========================================

// Permettre les requêtes depuis n'importe quelle origine (nécessaire pour Telegram)
app.use(cors());

// Permettre la lecture du JSON dans les requêtes (req.body)
app.use(express.json());

// Servir les fichiers statiques du dossier "public" (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// =========================================
// CONNEXION À POSTGRESQL
// =========================================

// Création du pool de connexions PostgreSQL
// Le pool gère plusieurs connexions simultanées automatiquement
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // SSL requis pour Neon.tech, Render, et tout hébergeur cloud
    // Si l'URL contient sslmode=require OU neon.tech, on active le SSL
    ssl: process.env.DATABASE_URL && (
        process.env.DATABASE_URL.includes('sslmode=require') ||
        process.env.DATABASE_URL.includes('neon.tech') ||
        process.env.DATABASE_URL.includes('render.com')
    )
        ? { rejectUnauthorized: false }
        : false
});

// Test de la connexion à la base de données au démarrage
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Erreur de connexion à PostgreSQL:', err.message);
    } else {
        console.log('✅ Connecté à PostgreSQL:', res.rows[0].now);
    }
});

// =========================================
// FONCTION UTILITAIRE : Initialiser la base de données
// Crée la table si elle n'existe pas encore
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
// =========================================

// ------------------------------------------
// GET /api/transactions
// Récupère toutes les transactions d'un utilisateur
// L'ID Telegram est passé dans le header de la requête
// ------------------------------------------
app.get('/api/transactions', async (req, res) => {
    // Récupération de l'identifiant Telegram depuis l'en-tête HTTP
    const telegramUserId = req.headers['x-telegram-user-id'];

    // Vérification : l'ID est-il fourni ?
    if (!telegramUserId) {
        return res.status(400).json({ error: 'ID utilisateur Telegram manquant' });
    }

    try {
        // Requête SQL : récupère toutes les transactions de cet utilisateur, triées par date
        const result = await pool.query(
            'SELECT * FROM transactions WHERE telegram_user_id = $1 ORDER BY date DESC, created_at DESC',
            [telegramUserId]
        );

        // Envoi des données au frontend
        res.json(result.rows);
    } catch (err) {
        console.error('Erreur GET /api/transactions:', err.message);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération des transactions' });
    }
});

// ------------------------------------------
// POST /api/transactions
// Ajoute une nouvelle transaction
// ------------------------------------------
app.post('/api/transactions', async (req, res) => {
    // Récupération de l'identifiant Telegram
    const telegramUserId = req.headers['x-telegram-user-id'];

    if (!telegramUserId) {
        return res.status(400).json({ error: 'ID utilisateur Telegram manquant' });
    }

    // Extraction des données envoyées par le formulaire
    const { type, amount, category, description, date } = req.body;

    // ---- Validation des données ----
    if (!type || !amount || !category || !date) {
        return res.status(400).json({ error: 'Champs obligatoires manquants : type, montant, catégorie, date' });
    }

    if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ error: 'Le type doit être "income" ou "expense"' });
    }

    if (isNaN(amount) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: 'Le montant doit être un nombre positif' });
    }

    try {
        // Insertion dans la base de données
        const result = await pool.query(
            `INSERT INTO transactions (telegram_user_id, type, amount, category, description, date)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [telegramUserId, type, parseFloat(amount), category, description || '', date]
        );

        // Retourne la transaction nouvellement créée
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Erreur POST /api/transactions:', err.message);
        res.status(500).json({ error: 'Erreur serveur lors de l\'ajout de la transaction' });
    }
});

// ------------------------------------------
// DELETE /api/transactions/:id
// Supprime une transaction par son ID
// ------------------------------------------
app.delete('/api/transactions/:id', async (req, res) => {
    const telegramUserId = req.headers['x-telegram-user-id'];
    const { id } = req.params;

    if (!telegramUserId) {
        return res.status(400).json({ error: 'ID utilisateur Telegram manquant' });
    }

    try {
        // On vérifie que la transaction appartient bien à cet utilisateur avant de supprimer
        const result = await pool.query(
            'DELETE FROM transactions WHERE id = $1 AND telegram_user_id = $2 RETURNING *',
            [id, telegramUserId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Transaction non trouvée ou non autorisée' });
        }

        res.json({ message: 'Transaction supprimée', transaction: result.rows[0] });
    } catch (err) {
        console.error('Erreur DELETE /api/transactions:', err.message);
        res.status(500).json({ error: 'Erreur serveur lors de la suppression' });
    }
});

// ------------------------------------------
// GET /api/summary
// Retourne le résumé financier : revenus, dépenses, solde
// ------------------------------------------
app.get('/api/summary', async (req, res) => {
    const telegramUserId = req.headers['x-telegram-user-id'];

    if (!telegramUserId) {
        return res.status(400).json({ error: 'ID utilisateur Telegram manquant' });
    }

    try {
        // Requête SQL : calcule la somme des revenus et des dépenses séparément
        const result = await pool.query(
            `SELECT
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS "totalIncome",
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS "totalExpenses"
             FROM transactions
             WHERE telegram_user_id = $1`,
            [telegramUserId]
        );

        const { totalIncome, totalExpenses } = result.rows[0];
        const balance = parseFloat(totalIncome) - parseFloat(totalExpenses);

        // Envoi du résumé
        res.json({
            totalIncome: parseFloat(totalIncome),
            totalExpenses: parseFloat(totalExpenses),
            balance: balance
        });
    } catch (err) {
        console.error('Erreur GET /api/summary:', err.message);
        res.status(500).json({ error: 'Erreur serveur lors du calcul du résumé' });
    }
});

// ------------------------------------------
// GET /api/categories-summary
// Retourne les dépenses regroupées par catégorie
// ------------------------------------------
app.get('/api/categories-summary', async (req, res) => {
    const telegramUserId = req.headers['x-telegram-user-id'];

    if (!telegramUserId) {
        return res.status(400).json({ error: 'ID utilisateur Telegram manquant' });
    }

    try {
        const result = await pool.query(
            `SELECT category, SUM(amount) AS total
             FROM transactions
             WHERE telegram_user_id = $1 AND type = 'expense'
             GROUP BY category
             ORDER BY total DESC`,
            [telegramUserId]
        );

        res.json(result.rows);
    } catch (err) {
        console.error('Erreur GET /api/categories-summary:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// =========================================
// ROUTE DE SANTÉ (health check)
// Render.com utilise cette route pour vérifier que le serveur tourne
// =========================================
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Budget Planner API en ligne' });
});

// =========================================
// DÉMARRAGE DU SERVEUR
// =========================================
async function startServer() {
    // Initialise la base de données (crée la table si besoin)
    await initDatabase();

    // Démarre le serveur sur le port défini
    app.listen(PORT, () => {
        console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
        console.log(`📱 Budget Planner prêt à être utilisé !`);
    });
}

// Lance le serveur
startServer();
