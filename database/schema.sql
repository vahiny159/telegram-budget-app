-- =========================================
-- SCHÉMA DE LA BASE DE DONNÉES
-- Ce fichier crée la table nécessaire pour l'application
-- Exécute ce fichier dans PostgreSQL pour créer la table
-- =========================================

-- Création de la table des transactions
CREATE TABLE IF NOT EXISTS transactions (
    -- Identifiant unique auto-incrémenté (créé automatiquement)
    id SERIAL PRIMARY KEY,

    -- Identifiant Telegram de l'utilisateur (pour filtrer ses données)
    telegram_user_id BIGINT NOT NULL,

    -- Type : 'income' (revenu) ou 'expense' (dépense)
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),

    -- Montant de la transaction (ex: 1500.50)
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),

    -- Catégorie (ex: Nourriture, Transport, etc.)
    category VARCHAR(100) NOT NULL,

    -- Description optionnelle
    description TEXT,

    -- Date de la transaction choisie par l'utilisateur
    date DATE NOT NULL,

    -- Date et heure de création automatique
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour accélérer les recherches par utilisateur Telegram
CREATE INDEX IF NOT EXISTS idx_transactions_telegram_user_id
    ON transactions(telegram_user_id);

-- Index pour accélérer les recherches par date
CREATE INDEX IF NOT EXISTS idx_transactions_date
    ON transactions(date);
