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

-- =========================================
-- Ajout de la table pour les limites de budget fixes
-- =========================================
-- (Si cette table existe déjà dans le code, je l'ajoute pour référence)
CREATE TABLE IF NOT EXISTS budgets (
    id SERIAL PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL,
    category VARCHAR(100) NOT NULL,
    monthly_limit DECIMAL(12, 2) NOT NULL CHECK (monthly_limit > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(telegram_user_id, category)
);

-- =========================================
-- Ajout de la table pour les objectifs d'épargne (Option Tirelire)
-- =========================================
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    target_amount DECIMAL(12, 2) NOT NULL CHECK (target_amount > 0),
    current_amount DECIMAL(12, 2) DEFAULT 0 CHECK (current_amount >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_goals_telegram_user_id
    ON goals(telegram_user_id);
