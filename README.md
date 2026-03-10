# 💰 Budget Familial - Telegram Mini App

Application de gestion de budget familial fonctionnant comme une Mini App Telegram.

---

## 📁 Structure du projet

```
budget-planner/
├── package.json          ← Dépendances Node.js
├── server.js             ← Serveur Express + API
├── .env.example          ← Modèle de configuration
├── database/
│   └── schema.sql        ← Schéma de la base de données
├── public/
│   ├── index.html        ← Interface utilisateur
│   ├── style.css         ← Styles
│   └── app.js            ← Logique JavaScript
└── README.md             ← Ce fichier
```

---

## 🚀 Lancer le projet en local

### Étape 1 : Prérequis
Assure-toi d'avoir installé :
- [Node.js](https://nodejs.org/) (version 18 ou plus)
- [PostgreSQL](https://www.postgresql.org/download/) (version 14 ou plus)

### Étape 2 : Installer les dépendances
```bash
npm install
```

### Étape 3 : Configurer l'environnement
1. Copie le fichier exemple :
   ```bash
   # Windows
   copy .env.example .env

   # Mac/Linux
   cp .env.example .env
   ```

2. Ouvre `.env` et modifie les valeurs :
   ```
   DATABASE_URL=postgresql://postgres:TON_MOT_DE_PASSE@localhost:5432/budget_db
   PORT=3000
   ```
   Remplace `TON_MOT_DE_PASSE` par ton mot de passe PostgreSQL.

### Étape 4 : Créer la base de données
Ouvre pgAdmin ou le terminal PostgreSQL et fais :
```sql
CREATE DATABASE budget_db;
```
Ensuite exécute le schéma (le serveur le fait automatiquement au démarrage via `initDatabase()`).

### Étape 5 : Lancer le serveur
```bash
node server.js
```

Tu devrais voir :
```
✅ Connecté à PostgreSQL: ...
✅ Table "transactions" prête
🚀 Serveur démarré sur http://localhost:3000
```

Ouvre http://localhost:3000 dans ton navigateur pour tester.

---

## ☁️ Déployer sur Render.com

### Étape 1 : Créer un compte Render
Va sur [render.com](https://render.com) et crée un compte gratuit.

### Étape 2 : Créer la base de données PostgreSQL
1. Dans le tableau de bord Render, clique **New +** → **PostgreSQL**
2. Remplis les champs :
   - **Name** : `budget-db`
   - **Region** : choisir la plus proche (ex: Frankfurt)
   - **Plan** : Free
3. Clique **Create Database**
4. **⚠️ Copie l'URL "Internal Database URL"** — tu en auras besoin à l'étape suivante

### Étape 3 : Déployer le serveur Node.js
1. Clique **New +** → **Web Service**
2. Connecte ton compte GitHub et sélectionne le dépôt
   > Si ton code n'est pas sur GitHub : crée un dépôt, pousse ton code, puis reviens ici
3. Configure le service :
   - **Name** : `budget-planner`
   - **Runtime** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `node server.js`
   - **Plan** : Free

### Étape 4 : Configurer les variables d'environnement
Dans la section **Environment** de ton Web Service, ajoute :

| Clé | Valeur |
|-----|--------|
| `DATABASE_URL` | L'URL copiée à l'étape 2 |

### Étape 5 : Déployer
Clique **Create Web Service**. Render va :
1. Installer les dépendances (`npm install`)
2. Démarrer le serveur (`node server.js`)
3. Te donner une URL publique du type : `https://budget-planner-xxxx.onrender.com`

**⚠️ Note** : Sur le plan gratuit, le serveur se "dort" après 15 minutes d'inactivité. Il se réveille au premier accès (attente de ~30 secondes). Pour éviter ça, utilise [UptimeRobot](https://uptimerobot.com) pour pinger `/health` toutes les 14 minutes.

---

## 📱 Configurer la Telegram Mini App

### Étape 1 : Créer un bot avec BotFather
1. Ouvre Telegram et cherche **@BotFather**
2. Envoie `/newbot`
3. Donne un nom à ton bot : ex. `Budget Familial`
4. Donne un username : ex. `monbudget_bot`
5. **Copie le token API** — ex: `1234567890:ABCdefGHIjklMNO...`

### Étape 2 : Configurer la Mini App
1. Envoie `/newapp` à BotFather
2. Sélectionne ton bot
3. Donne un titre : `Budget Familial`
4. Donne une description : `Gérez votre budget familial`
5. Envoie une photo (ou /empty pour ignorer)
6. Pour le GIF, envoie `/empty`
7. **URL de la web app** : entre l'URL Render de ton serveur :
   ```
   https://budget-planner-xxxx.onrender.com
   ```
8. Donne un nom court : `budget`

### Étape 3 : Créer un menu dans le bot (optionnel mais pratique)
Envoie à BotFather :
```
/setmenubutton
```
Sélectionne ton bot → **Configure menu button** → entre l'URL Render.

### Étape 4 : Tester
1. Ouvre Telegram → cherche ton bot → appuie sur **Menu** (ou `/start`)
2. L'application devrait s'ouvrir like une vraie app !

---

## 🔌 API Reference

### `GET /api/transactions`
Retourne toutes les transactions de l'utilisateur.
- **Header requis** : `x-telegram-user-id: <ID>`

### `POST /api/transactions`
Ajoute une nouvelle transaction.
- **Header requis** : `x-telegram-user-id: <ID>`
- **Body JSON** :
  ```json
  {
    "type": "income",
    "amount": 1500.00,
    "category": "💼 Salaire",
    "description": "Salaire du mois de janvier",
    "date": "2024-01-31"
  }
  ```

### `DELETE /api/transactions/:id`
Supprime une transaction.

### `GET /api/summary`
Retourne le résumé financier :
```json
{
  "totalIncome": 3000.00,
  "totalExpenses": 1200.00,
  "balance": 1800.00
}
```

### `GET /api/categories-summary`
Retourne les dépenses regroupées par catégorie.

### `GET /health`
Vérification d'état du serveur.

---

## ❓ Problèmes fréquents

**"Erreur de connexion à PostgreSQL"**
→ Vérifie que `DATABASE_URL` est correct dans `.env`

**"L'app ne s'ouvre pas dans Telegram"**
→ L'URL doit être en HTTPS (Render le fournit automatiquement)

**"Mes données ne s'affichent pas"**
→ L'app utilise ton ID Telegram pour filtrer. Assure-toi d'ouvrir depuis Telegram.

---

## 🛡️ Sécurité

Pour une application en production, il est recommandé de :
1. Valider la signature `initData` de Telegram côté backend
2. Ajouter un rate limiting (ex: `express-rate-limit`)
3. Ne jamais exposer la clé `DATABASE_URL` publiquement

---

*Fait avec ❤️ pour la gestion du budget familial*
