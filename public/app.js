// =========================================
// APP.JS - Logique Frontend
// Ce fichier gère toute l'interactivité de l'interface
// =========================================

// =========================================
// VARIABLES GLOBALES
// =========================================

// Stocke l'ID Telegram de l'utilisateur
let telegramUserId = null;

// Stocke toutes les transactions chargées (pour le filtrage)
let allTransactions = [];

// Catégories disponibles selon le type de transaction
const CATEGORIES = {
    income: [
        '💼 Salaire',
        '💰 Freelance',
        '🏠 Loyer perçu',
        '🎁 Cadeau / Don',
        '📈 Investissement',
        '🔄 Remboursement',
        '📦 Vente',
        '🌟 Autre revenu'
    ],
    expense: [
        '🛒 Nourriture',
        '🚗 Transport',
        '🏠 Logement',
        '💊 Santé',
        '💡 Factures',
        '🎓 Éducation',
        '🎮 Loisirs',
        '👕 Vêtements',
        '🐾 Animaux',
        '💰 Épargne',
        '📦 Divers'
    ]
};

// =========================================
// INITIALISATION AU CHARGEMENT DE LA PAGE
// =========================================

/**
 * Cette fonction s'exécute dès que la page est chargée.
 * Elle initialise l'intégration Telegram et charge les données.
 */
document.addEventListener('DOMContentLoaded', function () {
    console.log('📱 Application Budget Planner démarrée');

    // Initialisation de l'API Telegram Mini App
    initTelegram();

    // Définit la date d'aujourd'hui par défaut dans le formulaire
    setDefaultDate();

    // Met à jour les catégories dans le formulaire (income par défaut)
    updateCategories('income');

    // Charge les données du tableau de bord
    loadDashboard();

    // Charge l'historique des transactions
    loadTransactions();
});

// =========================================
// INTÉGRATION TELEGRAM
// =========================================

/**
 * Initialise l'API Telegram WebApp.
 * Récupère l'utilisateur connecté et configure l'interface.
 */
function initTelegram() {
    // Vérifie si l'API Telegram est disponible (on est dans Telegram)
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;

        // Signale à Telegram que l'app est prête
        tg.ready();

        // Adapte les couleurs de l'app au thème Telegram de l'utilisateur
        tg.expand(); // Ouvre l'app en plein écran

        // Récupère les informations de l'utilisateur
        const user = tg.initDataUnsafe?.user;

        if (user) {
            // Utilisateur Telegram identifié
            telegramUserId = user.id.toString();
            const displayName = user.first_name + (user.last_name ? ' ' + user.last_name : '');
            document.getElementById('userName').textContent = '👋 Bonjour, ' + displayName;
            console.log('✅ Utilisateur Telegram détecté:', telegramUserId, displayName);
        } else {
            // L'app est ouverte dans Telegram mais sans données utilisateur
            // (cas rare, peut arriver en développement)
            console.warn('⚠️ Données utilisateur Telegram non disponibles');
            useFallbackMode();
        }
    } else {
        // L'app n'est PAS dans Telegram (ex: ouverture dans un navigateur classique)
        console.warn('⚠️ Telegram WebApp non détecté - mode développement');
        useFallbackMode();
    }
}

/**
 * Mode de secours : utilisé quand l'app est ouverte hors Telegram.
 * Utilise un ID fictif pour les tests en local.
 */
function useFallbackMode() {
    // ID fictif pour les tests (ne pas utiliser en production)
    telegramUserId = '12345678';
    document.getElementById('userName').textContent = '🖥️ Mode développement local';
    console.log('🔧 Mode développement activé avec ID:', telegramUserId);
}

// =========================================
// NAVIGATION PAR ONGLETS
// =========================================

/**
 * Affiche l'onglet demandé et cache les autres.
 * @param {string} tabName - Nom de l'onglet à afficher ('dashboard', 'add', 'history')
 */
function showTab(tabName) {
    // Cache tous les contenus d'onglets
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Désactive tous les boutons d'onglets
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Affiche le contenu de l'onglet sélectionné
    const content = document.getElementById('tab-content-' + tabName);
    if (content) content.classList.add('active');

    // Active le bouton de l'onglet sélectionné
    const btn = document.getElementById('tab-' + tabName);
    if (btn) btn.classList.add('active');

    // Recharge les données si on va sur le tableau de bord ou l'historique
    if (tabName === 'dashboard') loadDashboard();
    if (tabName === 'history') loadTransactions();
}

// =========================================
// FORMULAIRE D'AJOUT DE TRANSACTION
// =========================================

/**
 * Gère la sélection du type (revenu ou dépense).
 * Met à jour l'apparence des boutons et les catégories disponibles.
 * @param {string} type - 'income' ou 'expense'
 */
function selectType(type) {
    // Met à jour la valeur cachée du formulaire
    document.getElementById('type').value = type;

    // Gestion visuelle des boutons
    const incomeBtn = document.getElementById('typeIncome');
    const expenseBtn = document.getElementById('typeExpense');

    incomeBtn.classList.remove('active');
    expenseBtn.classList.remove('active');

    if (type === 'income') {
        incomeBtn.classList.add('active');
    } else {
        expenseBtn.classList.add('active');
    }

    // Met à jour les catégories selon le type choisi
    updateCategories(type);
}

/**
 * Met à jour les options du sélecteur de catégories.
 * @param {string} type - 'income' ou 'expense'
 */
function updateCategories(type) {
    const select = document.getElementById('category');
    const categories = CATEGORIES[type];

    // Vide les options actuelles
    select.innerHTML = '<option value="">-- Choisir une catégorie --</option>';

    // Ajoute les nouvelles options
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
}

/**
 * Définit la date d'aujourd'hui comme valeur par défaut du champ date.
 */
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    document.getElementById('date').value = today;
}

/**
 * Gère la soumission du formulaire d'ajout de transaction.
 * Valide les données et les envoie à l'API.
 * @param {Event} event - L'événement de soumission du formulaire
 */
async function submitTransaction(event) {
    // Empêche le rechargement de la page (comportement par défaut du formulaire)
    event.preventDefault();

    // Vérification : l'utilisateur est-il identifié ?
    if (!telegramUserId) {
        showMessage('error', '❌ Impossible d\'identifier votre compte Telegram.');
        return;
    }

    // Récupération des valeurs du formulaire
    const type = document.getElementById('type').value;
    const amount = document.getElementById('amount').value;
    const category = document.getElementById('category').value;
    const description = document.getElementById('description').value.trim();
    const date = document.getElementById('date').value;

    // ---- Validation côté client ----
    if (!type) {
        showMessage('error', '❌ Veuillez choisir un type (revenu ou dépense).');
        return;
    }
    if (!amount || parseFloat(amount) <= 0) {
        showMessage('error', '❌ Veuillez entrer un montant valide (supérieur à 0).');
        return;
    }
    if (!category) {
        showMessage('error', '❌ Veuillez choisir une catégorie.');
        return;
    }
    if (!date) {
        showMessage('error', '❌ Veuillez choisir une date.');
        return;
    }

    // Désactive le bouton pour éviter les doubles soumissions
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Enregistrement...';

    try {
        // Envoi des données au backend
        const response = await fetch('/api/transactions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Envoi de l'ID Telegram dans l'en-tête
                'x-telegram-user-id': telegramUserId
            },
            body: JSON.stringify({ type, amount: parseFloat(amount), category, description, date })
        });

        const data = await response.json();

        if (response.ok) {
            // Succès : affiche le message et réinitialise le formulaire
            showMessage('success', '✅ Transaction enregistrée avec succès !');
            document.getElementById('transactionForm').reset();
            setDefaultDate();        // Remet la date d'aujourd'hui
            selectType('income');    // Remet le type à "revenu"

            // Petite vibration Telegram pour confirmer (si disponible)
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
        } else {
            showMessage('error', '❌ ' + (data.error || 'Erreur lors de l\'enregistrement.'));
        }
    } catch (err) {
        console.error('Erreur de connexion:', err);
        showMessage('error', '❌ Erreur de connexion au serveur. Vérifiez votre connexion internet.');
    }

    // Réactive le bouton
    submitBtn.disabled = false;
    submitBtn.textContent = '💾 Enregistrer la transaction';
}

/**
 * Affiche un message de succès ou d'erreur dans le formulaire.
 * @param {string} type - 'success' ou 'error'
 * @param {string} message - Le texte à afficher
 */
function showMessage(type, message) {
    const msgEl = document.getElementById('formMessage');
    msgEl.textContent = message;
    msgEl.className = 'form-message ' + type;

    // Fait disparaître le message après 4 secondes
    setTimeout(() => {
        msgEl.className = 'form-message hidden';
    }, 4000);
}

// =========================================
// TABLEAU DE BORD
// =========================================

/**
 * Charge et affiche le résumé financier (revenus, dépenses, solde)
 * et les dépenses par catégorie.
 */
async function loadDashboard() {
    if (!telegramUserId) return;

    try {
        // === Chargement du résumé financier ===
        const summaryRes = await fetch('/api/summary', {
            headers: { 'x-telegram-user-id': telegramUserId }
        });
        const summary = await summaryRes.json();

        if (summaryRes.ok) {
            // Mise à jour des cartes
            document.getElementById('totalIncome').textContent = formatAmount(summary.totalIncome);
            document.getElementById('totalExpenses').textContent = formatAmount(summary.totalExpenses);
            document.getElementById('balance').textContent = formatAmount(summary.balance);

            // Couleur du solde : bleu si positif, rouge si négatif
            const balanceCard = document.getElementById('balanceCard');
            if (summary.balance < 0) {
                balanceCard.classList.add('negative');
            } else {
                balanceCard.classList.remove('negative');
            }
        }

        // === Chargement des catégories ===
        const catRes = await fetch('/api/categories-summary', {
            headers: { 'x-telegram-user-id': telegramUserId }
        });
        const categories = await catRes.json();

        displayCategories(categories, summary.totalExpenses);

    } catch (err) {
        console.error('Erreur chargement dashboard:', err);
    }
}

/**
 * Affiche la liste des dépenses par catégorie avec une barre de progression.
 * @param {Array} categories - Liste des catégories avec leurs totaux
 * @param {number} totalExpenses - Total des dépenses pour calculer le pourcentage
 */
function displayCategories(categories, totalExpenses) {
    const container = document.getElementById('categoriesList');

    if (!categories || categories.length === 0) {
        container.innerHTML = '<p class="empty-message">Aucune dépense enregistrée.</p>';
        return;
    }

    container.innerHTML = categories.map(cat => {
        const percentage = totalExpenses > 0
            ? Math.round((parseFloat(cat.total) / parseFloat(totalExpenses)) * 100)
            : 0;

        return `
            <div class="category-item">
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="category-name">${cat.category}</span>
                        <span class="category-amount">${formatAmount(cat.total)}</span>
                    </div>
                    <div class="category-bar-container">
                        <div class="category-bar" style="width: ${percentage}%"></div>
                    </div>
                    <div style="font-size:0.7rem; color:#94a3b8; margin-top:2px;">${percentage}% des dépenses</div>
                </div>
            </div>
        `;
    }).join('');
}

// =========================================
// HISTORIQUE DES TRANSACTIONS
// =========================================

/**
 * Charge et affiche toutes les transactions de l'utilisateur.
 */
async function loadTransactions() {
    if (!telegramUserId) return;

    try {
        const response = await fetch('/api/transactions', {
            headers: { 'x-telegram-user-id': telegramUserId }
        });

        if (!response.ok) throw new Error('Erreur serveur');

        allTransactions = await response.json();
        displayTransactions(allTransactions);

    } catch (err) {
        console.error('Erreur chargement transactions:', err);
        document.getElementById('transactionsList').innerHTML =
            '<p class="empty-message">❌ Erreur de chargement. Vérifiez votre connexion.</p>';
    }
}

/**
 * Affiche une liste de transactions dans l'interface.
 * @param {Array} transactions - Les transactions à afficher
 */
function displayTransactions(transactions) {
    const container = document.getElementById('transactionsList');

    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<p class="empty-message">Aucune transaction enregistrée.<br>Utilisez l\'onglet ➕ Ajouter !</p>';
        return;
    }

    container.innerHTML = transactions.map(tx => {
        const isIncome = tx.type === 'income';
        const icon = isIncome ? '📈' : '📉';
        const sign = isIncome ? '+' : '-';
        const amountClass = isIncome ? 'income' : 'expense';
        const formattedDate = formatDate(tx.date);

        return `
            <div class="transaction-item" id="tx-${tx.id}">
                <span class="transaction-icon">${icon}</span>
                <div class="transaction-info">
                    <div class="transaction-category">${tx.category}</div>
                    <div class="transaction-description">${tx.description || 'Aucune description'}</div>
                    <div class="transaction-date">📅 ${formattedDate}</div>
                </div>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span class="transaction-amount ${amountClass}">
                        ${sign}${formatAmount(tx.amount)}
                    </span>
                    <button class="btn-delete" onclick="deleteTransaction(${tx.id})" title="Supprimer">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Filtre l'historique par type de transaction.
 * @param {string} filter - 'all', 'income' ou 'expense'
 * @param {HTMLElement} clickedBtn - Le bouton cliqué (pour le style actif)
 */
function filterHistory(filter, clickedBtn) {
    // Met à jour le style des boutons de filtre
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    clickedBtn.classList.add('active');

    // Filtre les transactions
    let filtered = allTransactions;
    if (filter === 'income') {
        filtered = allTransactions.filter(tx => tx.type === 'income');
    } else if (filter === 'expense') {
        filtered = allTransactions.filter(tx => tx.type === 'expense');
    }

    displayTransactions(filtered);
}

/**
 * Supprime une transaction après confirmation.
 * @param {number} id - L'ID de la transaction à supprimer
 */
async function deleteTransaction(id) {
    // Demande de confirmation
    const confirmed = confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?');
    if (!confirmed) return;

    try {
        const response = await fetch('/api/transactions/' + id, {
            method: 'DELETE',
            headers: { 'x-telegram-user-id': telegramUserId }
        });

        if (response.ok) {
            // Supprime visuellement l'élément sans recharger la page
            const element = document.getElementById('tx-' + id);
            if (element) {
                element.style.opacity = '0';
                element.style.transition = 'opacity 0.3s ease';
                setTimeout(() => {
                    element.remove();
                    // Met à jour le tableau en mémoire
                    allTransactions = allTransactions.filter(tx => tx.id !== id);
                    if (allTransactions.length === 0) {
                        document.getElementById('transactionsList').innerHTML =
                            '<p class="empty-message">Aucune transaction enregistrée.</p>';
                    }
                }, 300);
            }
        } else {
            alert('❌ Impossible de supprimer cette transaction.');
        }
    } catch (err) {
        console.error('Erreur suppression:', err);
        alert('❌ Erreur de connexion.');
    }
}

// =========================================
// FONCTIONS UTILITAIRES
// =========================================

/**
 * Formate un nombre en montant avec 2 décimales et symbole €.
 * Ex: 1500.5 → "1 500,50 €"
 * @param {number|string} amount - Le montant à formater
 * @returns {string} Le montant formaté
 */
function formatAmount(amount) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2
    }).format(parseFloat(amount) || 0);
}

/**
 * Formate une date ISO en format lisible.
 * Ex: "2024-01-15" → "15 jan. 2024"
 * @param {string} dateString - La date au format ISO
 * @returns {string} La date formatée
 */
function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}
