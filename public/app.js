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
 * Vérifie le budget pour la catégorie sélectionnée lors de la saisie d'une transaction.
 * Affiche une alerte si la dépense dépasse ou s'approche de la limite.
 */
function checkBudgetHint() {
    const hintDiv = document.getElementById('budgetHint');
    const type = document.getElementById('type').value;
    const category = document.getElementById('category').value;
    const amountVal = document.getElementById('amount').value;

    // Si ce n'est pas une dépense, pas de catégorie ou pas de montant : on cache l'alerte
    if (type !== 'expense' || !category || !amountVal || parseFloat(amountVal) <= 0) {
        hintDiv.style.display = 'none';
        return;
    }

    const amount = parseFloat(amountVal);
    const limit = userBudgets[category];

    // Si aucun budget défini pour cette catégorie
    if (!limit) {
        hintDiv.style.display = 'none';
        return;
    }

    // Calcul du total déjà dépensé ce mois pour cette catégorie
    let spentThisMonth = 0;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    allTransactions.forEach(tx => {
        if (tx.type === 'expense' && tx.category === category) {
            const txDate = new Date(tx.date);
            if (txDate.getMonth() + 1 === currentMonth && txDate.getFullYear() === currentYear) {
                spentThisMonth += parseFloat(tx.amount);
            }
        }
    });

    const newTotal = spentThisMonth + amount;
    const remaining = limit - spentThisMonth;

    if (newTotal > limit) {
        hintDiv.style.display = 'block';
        hintDiv.style.backgroundColor = 'var(--color-expense-bg)';
        hintDiv.style.color = 'var(--color-expense)';
        hintDiv.innerHTML = `⚠️ <b>Attention :</b> Cette dépense va dépasser votre budget restant (${formatAmount(remaining)}).`;
    } else if (newTotal >= limit * 0.85) {
        hintDiv.style.display = 'block';
        hintDiv.style.backgroundColor = '#fef3c7'; // Jaune clair
        hintDiv.style.color = '#b45309'; // Orange foncé
        hintDiv.innerHTML = `⚠️ <b>Bientôt épuisé :</b> Il vous restera ${formatAmount(limit - newTotal)} après cette transaction.`;
    } else {
        hintDiv.style.display = 'block';
        hintDiv.style.backgroundColor = 'var(--bg-tertiary)';
        hintDiv.style.color = 'var(--accent)';
        hintDiv.innerHTML = `✅ Budget respecté : Il restera ${formatAmount(limit - newTotal)}.`;
    }
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
            // Cache l'alerte budget après soumission
            document.getElementById('budgetHint').style.display = 'none';
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

            // --- Mise à jour de la Santé du Budget Global ---
            const globalCard = document.getElementById('globalBudgetCard');
            let totalBudgetLimit = 0;
            // On somme toutes les limites de budget définies
            if (Array.isArray(budgets)) {
                budgets.forEach(b => totalBudgetLimit += parseFloat(b.monthly_limit));
            }

            if (totalBudgetLimit > 0) {
                // Avoir au moins un budget défini affiche la carte globale
                globalCard.style.display = 'block';
                const totalExpenses = parseFloat(summary.totalExpenses) || 0;
                const percentage = Math.min((totalExpenses / totalBudgetLimit) * 100, 100).toFixed(1);

                document.getElementById('globalBudgetSpent').textContent = formatAmount(totalExpenses);
                document.getElementById('globalBudgetLimit').textContent = formatAmount(totalBudgetLimit);
                document.getElementById('globalBudgetPct').textContent = `${percentage}%`;

                const bar = document.getElementById('globalBudgetBar');
                const statusText = document.getElementById('globalBudgetStatusText');

                bar.style.width = `${percentage}%`;

                // Coloration sémantique (vert < 70%, orange < 90%, rouge > 90%)
                if (percentage >= 100) {
                    bar.style.backgroundColor = 'var(--color-expense)'; // Rouge
                    document.getElementById('globalBudgetPct').style.color = 'var(--color-expense)';
                    statusText.textContent = 'Dépassement !';
                    statusText.style.color = 'var(--color-expense)';
                } else if (percentage >= 85) {
                    bar.style.backgroundColor = '#f59e0b'; // Orange
                    document.getElementById('globalBudgetPct').style.color = '#f59e0b';
                    statusText.textContent = 'Attention, budget presque atteint';
                    statusText.style.color = '#f59e0b';
                } else {
                    bar.style.backgroundColor = 'var(--accent)'; // Bleu/Vert normal
                    document.getElementById('globalBudgetPct').style.color = 'var(--accent)';
                    statusText.textContent = 'Budget respecté';
                    statusText.style.color = 'var(--text-secondary)';
                }
            } else {
                // S'il n'y a aucun budget défini, on cache la carte
                globalCard.style.display = 'none';
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

        // --- Mise à jour de l'Objectif d'épargne ---
        await loadGoal();

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
                <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px; display:flex; justify-content:space-between; align-items:center;">
                    <span>Budget : ${formatAmount(total)} / ${formatAmount(limit)}</span>
                    ${overage > 0 ? `<span class="budget-overage" style="color:var(--color-expense); font-weight:600">Dépassement: +${formatAmount(overage)}</span>` : ''}
                </div>
            `;
        } else {
            // Pas de budget défini
            percentage = totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0;
            // Mode "Tableau de Bord Budgets" : Afficher un bouton au lieu de pourcentage
            budgetInfoHTML = `
                <div style="margin-top: 6px;">
                    <button class="budget-set-btn" onclick="openBudgetModal()" style="font-size:0.7rem; padding:0.2rem 0.5rem; background:var(--bg-tertiary); border:1px dashed var(--accent); color:var(--accent); border-radius:4px; cursor:pointer;">
                        + Définir un budget
                    </button>
                </div>
            `;
        }

        return `
            <div class="category-item">
                <div class="category-header">
                    <span class="category-name">${cat.category}</span>
                    <span class="category-amount" style="font-weight: 600;">${formatAmount(total)}</span>
                </div>
                ${budgetInfoHTML}
                ${limit ? `
                <div class="category-bar-container" style="margin-top:0.4rem; height:6px;">
                    <div class="category-bar" style="width: ${percentage}%; background-color: ${barColor}"></div>
                </div>` : ''}
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
            ? '<img src="icons/icon-income.svg" alt="Revenu" width="16" height="16" class="feather">'
            : '<img src="icons/icon-expense.svg" alt="Dépense" width="16" height="16" class="feather">';
        const sign = isIncome ? '+' : '-';
        const amountClass = isIncome ? 'income' : 'expense';
        const formattedDate = formatDate(tx.date);

        const recurIcon = tx.is_recurring
            ? '<img src="icons/icon-recurring.svg" alt="Récurrent" width="12" height="12" style="margin-right:4px; vertical-align:text-bottom">'
            : '';

        const calIcon = '<img src="icons/icon-calendar.svg" alt="Date" width="12" height="12" style="margin-right:4px">';

        const editIcon = '<img src="icons/action-edit.svg" alt="Modifier" width="18" height="18">';

        const deleteIcon = '<img src="icons/action-delete.svg" alt="Supprimer" width="18" height="18">';

        return `
            <div class="transaction-item" id="tx-${tx.id}">
                <span class="transaction-icon" style="background:var(--bg-secondary)">${icon}</span>
                <div class="transaction-info">
                    <div class="transaction-category">${tx.category}</div>
                    <div class="transaction-description" style="display:flex; align-items:center;">${recurIcon}${tx.description || 'Aucune description'}</div>
                    <div class="transaction-date" style="display:flex; align-items:center;">${calIcon} ${formattedDate}</div>
                </div>
                <div style="display:flex; align-items:center; gap:0.25rem;">
                    <span class="transaction-amount ${amountClass}">
                        ${sign}${formatAmount(tx.amount)}
                    </span>
                    <button class="btn-action btn-edit-tx" onclick="openEditModal(${tx.id})" title="Modifier">${editIcon}</button>
                    <button class="btn-action btn-delete-tx" onclick="deleteTransaction(${tx.id})" title="Supprimer">${deleteIcon}</button>
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
// OBJECTIF D'ÉPARGNE (TIRELIRE)
// =========================================
let currentGoalId = null;

async function loadGoal() {
    if (!telegramUserId) return;
    try {
        const response = await fetch('/api/goals', {
            headers: {
                'x-telegram-init-data': telegramInitData,
                'x-telegram-user-id': telegramUserId
            }
        });
        const goals = await response.json();

        const goalCard = document.getElementById('goalCard');
        const btnCreate = document.getElementById('btnCreateGoal');

        if (goals && goals.length > 0) {
            const goal = goals[0]; // Prend le plus récent
            currentGoalId = goal.id;

            goalCard.style.display = 'block';
            btnCreate.style.display = 'none';

            document.getElementById('goalName').textContent = goal.name;
            document.getElementById('goalTarget').textContent = formatAmount(goal.target_amount);
            document.getElementById('goalSaved').textContent = formatAmount(goal.current_amount);

            const pct = Math.min((goal.current_amount / goal.target_amount) * 100, 100).toFixed(1);
            document.getElementById('goalPct').textContent = pct + '%';
            document.getElementById('goalBar').style.width = pct + '%';
        } else {
            currentGoalId = null;
            goalCard.style.display = 'none';
            btnCreate.style.display = 'block';
        }
    } catch (err) {
        console.error('Erreur chargement objectif:', err);
    }
}

function openCreateGoalModal() {
    document.getElementById('goalCreateBackdrop').classList.add('active');
    document.getElementById('goalCreateModal').classList.add('active');
    document.getElementById('newGoalName').value = '';
    document.getElementById('newGoalTarget').value = '';
    document.getElementById('goalCreateMessage').className = 'form-message hidden';
}

function closeCreateGoalModal() {
    document.getElementById('goalCreateBackdrop').classList.remove('active');
    document.getElementById('goalCreateModal').classList.remove('active');
}

async function submitCreateGoal() {
    const name = document.getElementById('newGoalName').value.trim();
    const target = document.getElementById('newGoalTarget').value;
    const msgEl = document.getElementById('goalCreateMessage');
    const btn = document.getElementById('goalCreateSubmitBtn');

    if (!name || !target || parseFloat(target) <= 0) {
        msgEl.textContent = 'Veuillez remplir correctement les champs.';
        msgEl.className = 'form-message error';
        return;
    }

    btn.disabled = true;
    btn.textContent = '⏳...';

    try {
        const response = await fetch('/api/goals', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-telegram-init-data': telegramInitData,
                'x-telegram-user-id': telegramUserId
            },
            body: JSON.stringify({ name, target_amount: parseFloat(target) })
        });

        if (response.ok) {
            closeCreateGoalModal();
            loadDashboard(); // Recharge le dashboard
        } else {
            msgEl.textContent = 'Erreur lors de la création.';
            msgEl.className = 'form-message error';
        }
    } catch (err) {
        msgEl.textContent = 'Erreur de connexion.';
        msgEl.className = 'form-message error';
    }
    btn.disabled = false;
    btn.textContent = 'Créer';
}

function openAddFundsModal() {
    document.getElementById('goalAddFundsBackdrop').classList.add('active');
    document.getElementById('goalAddFundsModal').classList.add('active');
    document.getElementById('addFundsAmount').value = '';
    document.getElementById('goalAddFundsMessage').className = 'form-message hidden';
}

function closeAddFundsModal() {
    document.getElementById('goalAddFundsBackdrop').classList.remove('active');
    document.getElementById('goalAddFundsModal').classList.remove('active');
}

async function submitAddFunds() {
    if (!currentGoalId) return;
    const amount = document.getElementById('addFundsAmount').value;
    const msgEl = document.getElementById('goalAddFundsMessage');
    const btn = document.getElementById('goalAddFundsSubmitBtn');

    if (!amount || parseFloat(amount) <= 0) {
        msgEl.textContent = 'Veuillez entrer un montant valide.';
        msgEl.className = 'form-message error';
        return;
    }

    btn.disabled = true;
    btn.textContent = '⏳...';

    try {
        const response = await fetch('/api/goals/' + currentGoalId + '/add', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-telegram-init-data': telegramInitData,
                'x-telegram-user-id': telegramUserId
            },
            body: JSON.stringify({ amount: parseFloat(amount) })
        });

        if (response.ok) {
            closeAddFundsModal();
            loadDashboard(); // Recharge tout pour déduire du solde
        } else {
            msgEl.textContent = 'Erreur lors de l\'ajout.';
            msgEl.className = 'form-message error';
        }
    } catch (err) {
        msgEl.textContent = 'Erreur de connexion.';
        msgEl.className = 'form-message error';
    }
    btn.disabled = false;
    btn.textContent = 'Valider';
}

async function deleteGoal() {
    if (!currentGoalId) return;
    if (!confirm('Voulez-vous supprimer cet objectif ? (L\'argent déjà épargné reste comptabilisé comme dépense).')) return;

    try {
        const response = await fetch('/api/goals/' + currentGoalId, {
            method: 'DELETE',
            headers: {
                'x-telegram-init-data': telegramInitData,
                'x-telegram-user-id': telegramUserId
            }
        });

        if (response.ok) {
            loadDashboard();
        }
    } catch (err) { }
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

