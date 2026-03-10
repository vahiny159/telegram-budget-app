// =========================================
// APP.JS - Logique Frontend
// Ce fichier gère toute l'interactivité de l'interface
// =========================================

// =========================================
// VARIABLES GLOBALES
// =========================================

// Stocke l'ID Telegram de l'utilisateur (pour affichage uniquement)
let telegramUserId = null;

// Stocke l'initData signé par Telegram (envoyé au backend pour validation)
let telegramInitData = '';

// Stocke toutes les transactions chargées (pour le filtrage local)
let allTransactions = [];

// Mois et année actuellement affichés dans le navigateur
const today = new Date();
let currentMonth = today.getMonth() + 1; // 1–12
let currentYear = today.getFullYear();

// Instance du graphique Chart.js
let expenseChart = null;

// Dictionnaire des budgets par catégorie: { "Nourriture": 500000, ... }
let userBudgets = {};

// ID de la transaction en cours d'édition
let editingTransactionId = null;

// Palette de couleurs pour le graphique donut
const CHART_COLORS = [
    '#6366f1', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899',
    '#8b5cf6', '#14b8a6', '#f97316', '#ef4444', '#a855f7', '#06b6d4', '#84cc16'
];

// Catégories disponibles selon le type de transaction
const CATEGORIES = {
    income: [
        'Salaire',
        'Freelance',
        'Loyer perçu',
        'Cadeau / Don',
        'Investissement',
        'Remboursement',
        'Vente',
        'Autre revenu'
    ],
    expense: [
        'Nourriture',
        'Transport',
        'Logement',
        'Santé',
        'Factures',
        'Éducation',
        'Loisirs',
        'Vêtements',
        'Animaux',
        'Épargne',
        'Divers'
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
    console.log('📱 Budget Planner démarré');
    initTelegram();
    setDefaultDate();
    updateCategories('income');
    initMonthNav();
    initChart();      // Initialise le graphique donut
    loadDashboard();
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
        tg.expand(); // Ouvre l'app en plein écran

        // 🔒 Récupère l'initData signé — c'est ce qui prouve l'authenticité
        //    de l'utilisateur. Le backend va vérifier sa signature HMAC.
        telegramInitData = tg.initData || '';

        // Récupère les infos utilisateur pour l'affichage (non sécurisé, juste pour l'UI)
        const user = tg.initDataUnsafe?.user;

        if (user) {
            telegramUserId = user.id.toString();
            const displayName = user.first_name + (user.last_name ? ' ' + user.last_name : '');
            document.getElementById('userName').textContent = '👋 Bonjour, ' + displayName;
            console.log('✅ Utilisateur Telegram identifié:', telegramUserId);
        } else {
            console.warn('⚠️ Données utilisateur Telegram non disponibles');
            useFallbackMode();
        }
    } else {
        // L'app est ouverte hors Telegram (navigateur classique = mode développement)
        console.warn('⚠️ Telegram WebApp non détecté - mode développement');
        useFallbackMode();
    }
}

/**
 * Mode de secours pour les tests en local (hors Telegram).
 * Le backend accepte les requêtes sans validation si BOT_TOKEN n'est pas défini.
 */
function useFallbackMode() {
    telegramUserId = 'dev-user';
    telegramInitData = ''; // Vide → le backend bypasse la validation en mode dev
    document.getElementById('userName').textContent = '🖥️ Mode développement local';
    console.log('🔧 Mode développement — validation Telegram désactivée côté serveur');
}

// =========================================
// NAVIGATEUR DE MOIS
// =========================================

/** Noms des mois en français */
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/**
 * Initialise le navigateur de mois : met à jour le label et l'état des boutons.
 */
function initMonthNav() {
    updateMonthNav();
}

/**
 * Met à jour le label du mois et l'état du bouton "suivant".
 */
function updateMonthNav() {
    document.getElementById('monthLabel').textContent =
        MONTHS_FR[currentMonth - 1] + ' ' + currentYear;

    // Désactive le bouton "suivant" si on est déjà au mois actuel
    const nowMonth = today.getMonth() + 1;
    const nowYear = today.getFullYear();
    const isCurrentMonth = (currentMonth === nowMonth && currentYear === nowYear);
    document.getElementById('nextMonthBtn').disabled = isCurrentMonth;

    // Affiche/Cache le bouton "Aujourd'hui"
    const todayBtn = document.getElementById('todayBtn');
    todayBtn.style.display = isCurrentMonth ? 'none' : 'inline-block';
}

/**
 * Navigue vers le mois précédent ou suivant.
 * @param {number} direction - -1 pour précédent, +1 pour suivant
 */
function changeMonth(direction) {
    currentMonth += direction;

    if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    if (currentMonth > 12) { currentMonth = 1; currentYear++; }

    // Empêche de dépasser le mois actuel
    const nowMonth = today.getMonth() + 1;
    const nowYear = today.getFullYear();
    if (currentYear > nowYear || (currentYear === nowYear && currentMonth > nowMonth)) {
        currentMonth = nowMonth;
        currentYear = nowYear;
    }

    // Animation de transition
    const label = document.getElementById('monthLabel');
    label.style.opacity = '0';
    setTimeout(() => {
        updateMonthNav();
        label.style.opacity = '1';
        // Recharge les données pour le nouveau mois
        loadDashboard();
        loadTransactions();
    }, 150);
}

/**
 * Revient au mois actuel.
 */
function goToToday() {
    currentMonth = today.getMonth() + 1;
    currentYear = today.getFullYear();
    updateMonthNav();
    loadDashboard();
    loadTransactions();
}

// =========================================
// GRAPHIQUE DONUT (CHART.JS)
// =========================================

/**
 * Initialise le graphique donut Chart.js.
 * Appelé une seule fois au chargement de la page.
 */
function initChart() {
    const canvas = document.getElementById('expenseChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    expenseChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: CHART_COLORS,
                borderColor: '#0f172a',   // = --bg-primary, crée des séparations nettes
                borderWidth: 2,
                hoverOffset: 10,           // Le segment s'agrandit au survol
                hoverBorderWidth: 0
            }]
        },
        options: {
            cutout: '68%',               // Épaisseur de l'anneau
            animation: {
                duration: 700,
                easing: 'easeInOutCubic'
            },
            plugins: {
                legend: { display: false }, // On utilise notre légende custom
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.label}: ${formatAmount(ctx.parsed)}`
                    },
                    backgroundColor: '#1e293b',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: '#334155',
                    borderWidth: 1
                }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

/**
 * Met à jour le graphique et la légende avec les nouvelles données.
 * @param {Array} categories - [{category, total}, ...]
 * @param {number} totalExpenses - Total pour les pourcentages
 */
function updateChart(categories, totalExpenses) {
    // Mise à jour du texte central
    const centerEl = document.getElementById('chartCenterAmount');
    if (centerEl) {
        centerEl.textContent = categories.length > 0
            ? formatAmount(totalExpenses)
            : '–';
    }

    if (!expenseChart) return;

    const labels = categories.map(c => c.category);
    const data = categories.map(c => parseFloat(c.total));
    const colors = CHART_COLORS.slice(0, labels.length);

    expenseChart.data.labels = labels;
    expenseChart.data.datasets[0].data = data;
    expenseChart.data.datasets[0].backgroundColor = colors;
    expenseChart.update();

    // Construction de la légende
    const legend = document.getElementById('chartLegend');
    if (!legend) return;

    if (categories.length === 0) {
        legend.innerHTML = '<p style="color:var(--text-secondary);font-size:0.8rem;padding:0.25rem">Aucune dépense ce mois.</p>';
        return;
    }

    legend.innerHTML = categories.map((cat, i) => {
        const pct = totalExpenses > 0
            ? Math.round((parseFloat(cat.total) / totalExpenses) * 100)
            : 0;
        return `
            <div class="legend-item">
                <span class="legend-dot" style="background:${colors[i] || '#6366f1'}"></span>
                <span class="legend-name">${cat.category}</span>
                <span class="legend-pct">${pct}%</span>
            </div>`;
    }).join('');
}

// =========================================
// MODAL D'ÉDITION
// =========================================

/**
 * Ouvre le bottom sheet d'édition pré-rempli avec les données de la transaction.
 * @param {number} id - L'ID de la transaction à éditer
 */
function openEditModal(id) {
    const tx = allTransactions.find(t => t.id === id);
    if (!tx) return;
    editingTransactionId = id;

    // Pré-remplit tous les champs
    document.getElementById('editId').value = tx.id;
    document.getElementById('editAmount').value = Math.round(tx.amount);
    document.getElementById('editDescription').value = tx.description || '';
    // La date pgSQL peut être un objet Date ou une chaîne ISO — on extrait YYYY-MM-DD
    document.getElementById('editDate').value = String(tx.date).substring(0, 10);

    // Sélectionne le type et met à jour les catégories
    selectEditType(tx.type);
    // Attend la mise à jour du select puis sélectionne la bonne catégorie
    setTimeout(() => {
        document.getElementById('editCategory').value = tx.category;
    }, 0);

    // Masque les messages résiduels
    const msg = document.getElementById('editMessage');
    if (msg) msg.className = 'form-message hidden';

    // Ouvre le bottom sheet
    document.getElementById('editBackdrop').classList.add('active');
    document.getElementById('editModal').classList.add('active');
    document.body.style.overflow = 'hidden'; // Empêche le scroll arrière-plan

    // Vibration Telegram (feedback haptique)
    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
}

/**
 * Sélectionne le type dans le formulaire d'édition et met à jour les catégories.
 * @param {string} type - 'income' ou 'expense'
 */
function selectEditType(type) {
    document.getElementById('editType').value = type;
    const incBtn = document.getElementById('editTypeIncome');
    const expBtn = document.getElementById('editTypeExpense');
    incBtn.classList.remove('active');
    expBtn.classList.remove('active');
    if (type === 'income') incBtn.classList.add('active');
    else expBtn.classList.add('active');
    updateEditCategories(type);
}

/**
 * Met à jour les options du select de catégorie dans le modal d'édition.
 * @param {string} type - 'income' ou 'expense'
 */
function updateEditCategories(type) {
    const select = document.getElementById('editCategory');
    const cats = CATEGORIES[type];
    select.innerHTML = '<option value="">-- Choisir --</option>' +
        cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

/**
 * Ferme le modal d'édition avec animation.
 */
function closeEditModal() {
    document.getElementById('editBackdrop').classList.remove('active');
    document.getElementById('editModal').classList.remove('active');
    document.body.style.overflow = '';
    editingTransactionId = null;
}

/**
 * Soumet la modification de la transaction via PUT.
 */
async function submitEdit() {
    const id = document.getElementById('editId').value;
    const type = document.getElementById('editType').value;
    const amount = document.getElementById('editAmount').value;
    const category = document.getElementById('editCategory').value;
    const description = document.getElementById('editDescription').value.trim();
    const date = document.getElementById('editDate').value;
    const msgEl = document.getElementById('editMessage');

    // Validation client
    if (!amount || parseFloat(amount) <= 0) {
        msgEl.textContent = '❌ Montant invalide.';
        msgEl.className = 'form-message error';
        return;
    }
    if (!category) {
        msgEl.textContent = '❌ Veuillez choisir une catégorie.';
        msgEl.className = 'form-message error';
        return;
    }

    const btn = document.getElementById('editSubmitBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Enregistrement...';

    try {
        const response = await fetch('/api/transactions/' + id, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-telegram-init-data': telegramInitData,
                'x-telegram-user-id': telegramUserId
            },
            body: JSON.stringify({ type, amount: parseFloat(amount), category, description, date })
        });

        if (response.ok) {
            // Succès
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
            closeEditModal();
            // Recharge les données
            await Promise.all([loadTransactions(), loadDashboard()]);
        } else {
            const data = await response.json();
            msgEl.textContent = '❌ ' + (data.error || 'Erreur serveur.');
            msgEl.className = 'form-message error';
        }
    } catch (err) {
        console.error('Erreur PUT:', err);
        msgEl.textContent = '❌ Erreur de connexion.';
        msgEl.className = 'form-message error';
    }

    btn.disabled = false;
    btn.textContent = '💾 Enregistrer';
}


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
    const isRecurring = document.getElementById('isRecurring') ? document.getElementById('isRecurring').checked : false;

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
                // 🔒 On envoie l'initData signé par Telegram (pas juste l'ID)
                //    Le backend vérifie la signature avant d'accepter la requête
                'x-telegram-init-data': telegramInitData,
                'x-telegram-user-id': telegramUserId  // Fallback mode dev
            },
            body: JSON.stringify({ type, amount: parseFloat(amount), category, description, date, is_recurring: isRecurring })
        });

        const data = await response.json();

        if (response.ok) {
            // Succès : affiche le message et réinitialise le formulaire
            showMessage('success', '✅ Transaction enregistrée avec succès !');
            document.getElementById('transactionForm').reset();
            if (document.getElementById('isRecurring')) {
                document.getElementById('isRecurring').checked = false;
            }
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
        // En-têtes d'authentification + filtrage par mois
        const authHeaders = {
            'x-telegram-init-data': telegramInitData,
            'x-telegram-user-id': telegramUserId
        };
        const monthParams = `month=${currentMonth}&year=${currentYear}`;

        // Calcul du mois précédent pour la comparaison
        let prevMonth = currentMonth - 1;
        let prevYear = currentYear;
        if (prevMonth === 0) { prevMonth = 12; prevYear--; }
        const prevMonthParams = `month=${prevMonth}&year=${prevYear}`;

        // === Chargement en parallèle ===
        const [summaryRes, prevSummaryRes, catRes, budgetRes, pendingRes] = await Promise.all([
            fetch(`/api/summary?${monthParams}`, { headers: authHeaders }),
            fetch(`/api/summary?${prevMonthParams}`, { headers: authHeaders }),
            fetch(`/api/categories-summary?${monthParams}`, { headers: authHeaders }),
            fetch('/api/budgets', { headers: authHeaders }),
            fetch(`/api/pending-recurring?${monthParams}`, { headers: authHeaders })
        ]);

        const summary = await summaryRes.json();
        const prevSummary = await prevSummaryRes.json();
        const categories = await catRes.json();
        const budgets = await budgetRes.json();
        const pending = await pendingRes.json();

        // Stockage global des budgets (pour y accéder depuis d'autres fonctions)
        userBudgets = {};
        if (Array.isArray(budgets)) {
            budgets.forEach(b => userBudgets[b.category] = parseFloat(b.monthly_limit));
        }

        // --- Mise à jour du résumé ---
        if (summaryRes.ok) {
            document.getElementById('totalIncome').textContent = formatAmount(summary.totalIncome);
            document.getElementById('totalExpenses').textContent = formatAmount(summary.totalExpenses);
            document.getElementById('balance').textContent = formatAmount(summary.balance);

            const balanceCard = document.getElementById('balanceCard');
            if (summary.balance < 0) {
                balanceCard.classList.add('negative');
            } else {
                balanceCard.classList.remove('negative');
            }
        }

        // --- Mise à jour de la comparaison avec le mois précédent ---
        const compBar = document.getElementById('comparisonBar');
        if (prevSummaryRes.ok && (prevSummary.totalIncome > 0 || prevSummary.totalExpenses > 0)) {
            compBar.style.display = 'flex';

            const incDiff = summary.totalIncome - prevSummary.totalIncome;
            const expDiff = summary.totalExpenses - prevSummary.totalExpenses;

            const compIncome = document.getElementById('compIncome');
            const compExpense = document.getElementById('compExpense');

            // Revenus
            if (incDiff > 0) {
                compIncome.textContent = 'Revenus ▲ ' + formatAmount(incDiff);
                compIncome.className = 'comp-item positive';
            } else if (incDiff < 0) {
                compIncome.textContent = 'Revenus ▼ ' + formatAmount(Math.abs(incDiff));
                compIncome.className = 'comp-item negative'; // Moins de revenus = négatif
            } else {
                compIncome.textContent = 'Revenus =';
                compIncome.className = 'comp-item neutral';
            }

            // Dépenses
            if (expDiff > 0) {
                compExpense.textContent = 'Dépenses ▲ ' + formatAmount(expDiff);
                compExpense.className = 'comp-item negative'; // Plus de dépenses = négatif
            } else if (expDiff < 0) {
                compExpense.textContent = 'Dépenses ▼ ' + formatAmount(Math.abs(expDiff));
                compExpense.className = 'comp-item positive'; // Moins de dépenses = positif
            } else {
                compExpense.textContent = 'Dépenses =';
                compExpense.className = 'comp-item neutral';
            }
        } else {
            compBar.style.display = 'none';
        }

        // --- Mise à jour des récurrences en attente ---
        const pendingSection = document.getElementById('pendingSection');
        if (pendingRes.ok && pending.length > 0) {
            pendingSection.style.display = 'block';
            document.getElementById('pendingBadge').textContent = pending.length;

            document.getElementById('pendingList').innerHTML = pending.map(tx => `
                <div class="pending-item">
                    <div>
                        <span style="font-weight:600">${tx.category}</span>
                        <div style="font-size:0.7rem; color:var(--text-secondary)">${tx.description || 'Transaction récurrente'}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.5rem">
                        <span class="${tx.type === 'income' ? 'income' : 'expense'}" style="font-weight:600">
                            ${formatAmount(tx.amount)}
                        </span>
                        <button class="btn-edit" onclick="applyRecurring(${tx.id})" style="background:var(--accent); color:white; padding:0.2rem 0.5rem; border-radius:4px; font-size:0.75rem;">
                            Ajouter
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            pendingSection.style.display = 'none';
        }

        // --- Mise à jour des catégories ---
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
    // Met à jour le graphique donut
    updateChart(categories || [], parseFloat(totalExpenses) || 0);

    const container = document.getElementById('categoriesList');
    if (!container) return;

    if (!categories || categories.length === 0) {
        container.innerHTML = '<p class="empty-message">Aucune dépense ce mois.</p>';
        return;
    }

    container.innerHTML = categories.map(cat => {
        const total = parseFloat(cat.total);
        const limit = userBudgets[cat.category];

        let percentage = 0;
        let barColor = 'var(--accent)';
        let budgetInfoHTML = '';

        if (limit) {
            // Calcul par rapport au budget défini
            percentage = Math.round((total / limit) * 100);
            if (percentage > 100) {
                percentage = 100;
                barColor = 'var(--color-expense)'; // Rouge si dépassé
            } else if (percentage > 85) {
                barColor = '#f59e0b'; // Orange si presque dépassé
            }
            const overage = total - limit;
            budgetInfoHTML = `
                <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">
                    Budget : ${formatAmount(total)} / ${formatAmount(limit)}
                </div>
                ${overage > 0 ? `<div class="budget-overage">⚠️ Dépassement de ${formatAmount(overage)}</div>` : ''}
            `;
        } else {
            // Calcul par rapport au total des dépenses (comportement par défaut)
            percentage = totalExpenses > 0 ? Math.round((total / parseFloat(totalExpenses)) * 100) : 0;
            budgetInfoHTML = `<div style="font-size:0.7rem; color:var(--text-secondary); margin-top:2px;">${percentage}% des dépenses</div>`;
        }

        return `
            <div class="category-item">
                <div style="flex: 1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="category-name">${cat.category}</span>
                        <span class="category-amount" style="${limit && total > limit ? 'color:var(--color-expense)' : ''}">${formatAmount(total)}</span>
                    </div>
                    <div class="category-bar-container">
                        <div class="category-bar" style="width:${percentage}%; background-color:${barColor}"></div>
                    </div>
                    ${budgetInfoHTML}
                </div>
            </div>`;
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
        const response = await fetch(`/api/transactions?month=${currentMonth}&year=${currentYear}`, {
            headers: {
                'x-telegram-init-data': telegramInitData,
                'x-telegram-user-id': telegramUserId
            }
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
        const icon = isIncome
            ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>';
        const sign = isIncome ? '+' : '-';
        const amountClass = isIncome ? 'income' : 'expense';
        const formattedDate = formatDate(tx.date);

        const recurIcon = tx.is_recurring
            ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; vertical-align:text-bottom"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>'
            : '';

        const calIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>';

        const editIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>';

        const deleteIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>';

        return `
            <div class="transaction-item" id="tx-${tx.id}">
                <span class="transaction-icon" style="background:var(--bg-secondary)">${icon}</span>
                <div class="transaction-info">
                    <div class="transaction-category">${tx.category}</div>
                    <div class="transaction-description" style="display:flex; align-items:center;">${recurIcon}${tx.description || 'Aucune description'}</div>
                    <div class="transaction-date" style="display:flex; align-items:center;">${calIcon} ${formattedDate}</div>
                </div>
                <div style="display:flex; align-items:center; gap:0.4rem;">
                    <span class="transaction-amount ${amountClass}">
                        ${sign}${formatAmount(tx.amount)}
                    </span>
                    <button class="btn-edit-icon" onclick="openEditModal(${tx.id})" title="Modifier" style="background:none; border:none; color:var(--text-secondary); cursor:pointer">${editIcon}</button>
                    <button class="btn-delete-icon" onclick="deleteTransaction(${tx.id})" title="Supprimer" style="background:none; border:none; color:var(--color-expense); cursor:pointer">${deleteIcon}</button>
                </div>
            </div>`;
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
            headers: {
                'x-telegram-init-data': telegramInitData,
                'x-telegram-user-id': telegramUserId
            }
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
// GESTION DES BUDGETS PAR CATÉGORIE
// =========================================

/**
 * Ouvre le modal de paramétrage des budgets.
 * Génère un champ pour chaque catégorie de dépense.
 */
function openBudgetModal() {
    const listContainer = document.getElementById('budgetFormList');
    const categories = CATEGORIES.expense;

    listContainer.innerHTML = categories.map(cat => {
        const currentLimit = userBudgets[cat] || '';
        return `
            <div class="budget-row">
                <label>${cat}</label>
                <div class="budget-input-wrapper">
                    <input type="number" id="budget_${cat}" value="${currentLimit}" placeholder="0" min="0" step="1000">
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('budgetBackdrop').classList.add('active');
    document.getElementById('budgetModal').classList.add('active');
    document.body.style.overflow = 'hidden';

    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
}

/**
 * Ferme le modal des budgets.
 */
function closeBudgetModal() {
    document.getElementById('budgetBackdrop').classList.remove('active');
    document.getElementById('budgetModal').classList.remove('active');
    document.body.style.overflow = '';
}

/**
 * Sauvegarde les budgets modifiés via l'API.
 */
async function saveBudgets() {
    if (!telegramUserId) return;
    const btn = document.querySelector('#budgetModal .btn-primary');
    btn.disabled = true;
    btn.textContent = '⏳ ...';

    try {
        const categories = CATEGORIES.expense;
        for (const cat of categories) {
            const input = document.getElementById(`budget_${cat}`);
            const limit = parseFloat(input.value);

            // Si vide ou 0, on supprime le budget (DELETE)
            if (!limit || limit <= 0) {
                if (userBudgets[cat]) { // Si existait avant
                    await fetch(`/api/budgets/${encodeURIComponent(cat)}`, {
                        method: 'DELETE',
                        headers: {
                            'x-telegram-init-data': telegramInitData,
                            'x-telegram-user-id': telegramUserId
                        }
                    });
                }
                delete userBudgets[cat];
            }
            // Sinon on crée/met à jour (POST)
            else {
                await fetch('/api/budgets', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-telegram-init-data': telegramInitData,
                        'x-telegram-user-id': telegramUserId
                    },
                    body: JSON.stringify({ category: cat, monthly_limit: limit })
                });
                userBudgets[cat] = limit;
            }
        }

        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        closeBudgetModal();
        loadDashboard(); // Recharge le dashboard pour MAJ des barres

    } catch (err) {
        console.error('Erreur saveBudgets:', err);
        alert('Erreur lors de la sauvegarde');
    }

    btn.disabled = false;
    btn.textContent = '💾 Enregistrer';
}

// =========================================
// ACTION : APPLIQUER RÉCURRENCE
// =========================================

/**
 * Copie une transaction récurrente pendante sur le mois actuel.
 * @param {number} txId - ID de la transaction à dupliquer
 */
async function applyRecurring(txId) {
    if (!telegramUserId) return;

    // Confirmer rapidement ? Non on clique direct c'est plus UX
    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }

    try {
        const response = await fetch('/api/apply-recurring', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-telegram-init-data': telegramInitData,
                'x-telegram-user-id': telegramUserId
            },
            body: JSON.stringify({
                transaction_id: txId,
                month: currentMonth,
                year: currentYear
            })
        });

        if (response.ok) {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
            // Recharge UI
            loadDashboard();
            loadTransactions();
        } else {
            console.error('Erreur API recurrente');
        }
    } catch (err) {
        console.error('Erreur applyRecurring:', err);
    }
}

// =========================================
// UTILITAIRES
// =========================================

/**
 * Formate un nombre en Ariary malagasy.
 * Ex: 1500000 → "1 500 000 Ar"
 * L'Ariary n'utilise pas de centimes dans la pratique.
 * @param {number|string} amount - Le montant à formater
 * @returns {string} Le montant formaté en Ariary
 */
function formatAmount(amount) {
    const num = Math.round(parseFloat(amount) || 0);
    // Séparateur de milliers avec espace (style malagasy)
    const formatted = num.toLocaleString('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
    return formatted + ' Ar';
}

/**
 * Formate une date en format lisible.
 * Gère les deux cas que PostgreSQL peut retourner :
 *   - chaîne "YYYY-MM-DD"
 *   - chaîne ISO complète "2026-03-10T00:00:00.000Z"
 * @param {string|Date} rawDate - La date brute reçue du serveur
 * @returns {string} La date formatée en français
 */
function formatDate(rawDate) {
    // Extraction des 10 premiers caractères = "YYYY-MM-DD"
    const datePart = String(rawDate).substring(0, 10);
    // On parse à midi (12:00) pour éviter les décalages de timezone
    const date = new Date(datePart + 'T12:00:00');
    if (isNaN(date.getTime())) return String(rawDate); // fallback lisible
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

