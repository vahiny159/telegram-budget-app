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

// Mois et année affichés dans le navigateur
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
        'Pharmacie',
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
    loadFamily();     // Charge le statut famille
});

// =========================================
// PARTAGE FAMILIAL
// =========================================

let familyInfo = null;

async function loadFamily() {
    try {
        const res = await fetch('/api/family', {
            headers: {
                'x-telegram-init-data': telegramInitData,
                'x-telegram-user-id': telegramUserId
            }
        });
        if (res.ok) {
            familyInfo = await res.json();
            updateFamilyBadge();
        }
    } catch (err) {
        console.error('Erreur loadFamily:', err);
    }
}

function updateFamilyBadge() {
    const badge = document.getElementById('familyBadgeText');
    if (!badge) return;
    if (familyInfo && familyInfo.inFamily) {
        badge.textContent = `Famille (${familyInfo.memberCount} membres)`;
    } else {
        badge.textContent = 'Partage familial';
    }
}

function toggleSettingsMenu() {
    const dd = document.getElementById('settingsDropdown');
    if (!dd) return;
    const isOpen = dd.style.display !== 'none';
    dd.style.display = isOpen ? 'none' : 'block';

    // Ferme le menu si on clique ailleurs
    if (!isOpen) {
        setTimeout(() => {
            document.addEventListener('click', closeSettingsOnClickOutside, { once: true });
        }, 10);
    }
}

function closeSettingsOnClickOutside(e) {
    const dd = document.getElementById('settingsDropdown');
    const btn = document.getElementById('settingsBtn');
    if (dd && !dd.contains(e.target) && !btn.contains(e.target)) {
        dd.style.display = 'none';
    }
}

function openFamilyModal() {
    document.getElementById('familyModal').style.display = 'flex';
    renderFamilyModalContent();
}

function closeFamilyModal() {
    document.getElementById('familyModal').style.display = 'none';
}

function renderFamilyModalContent() {
    const body = document.getElementById('familyModalBody');
    if (!body) return;

    if (familyInfo && familyInfo.inFamily) {
        // Déjà dans une famille
        body.innerHTML = `
            <div style="text-align:center; padding:1rem 0;">
                <div style="font-size:2rem; margin-bottom:0.5rem;">✅</div>
                <p style="font-weight:600; margin-bottom:0.25rem;">Famille active</p>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:1rem;">
                    ${familyInfo.memberCount} membre${familyInfo.memberCount > 1 ? 's' : ''} connecté${familyInfo.memberCount > 1 ? 's' : ''}
                </p>
                <div style="background:var(--bg-tertiary); border-radius:8px; padding:0.75rem; margin-bottom:1rem;">
                    <p style="font-size:0.7rem; color:var(--text-secondary); margin-bottom:0.25rem;">Code d'invitation</p>
                    <p style="font-size:1.5rem; font-weight:700; letter-spacing:0.2em; font-family:monospace;">${familyInfo.inviteCode}</p>
                    <p style="font-size:0.7rem; color:var(--text-secondary); margin-top:0.25rem;">Partagez ce code pour inviter un membre</p>
                </div>
                <button onclick="leaveFamily()" style="background:transparent; color:#dc2626; border:1px solid #dc2626; padding:0.5rem 1rem; border-radius:8px; cursor:pointer; font-family:inherit; font-size:0.8rem;">
                    ${familyInfo.isOwner ? '🗑️ Supprimer la famille' : '🚪 Quitter la famille'}
                </button>
            </div>
        `;
    } else {
        // Pas dans une famille
        body.innerHTML = `
            <div style="text-align:center; padding:0.5rem 0;">
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">
                    Partagez vos données avec votre conjoint(e). Créez une famille ou rejoignez-en une avec un code.
                </p>
                <button onclick="createFamily()" style="width:100%; background:var(--accent); color:white; border:none; padding:0.75rem; border-radius:8px; cursor:pointer; font-family:inherit; font-weight:600; font-size:0.9rem; margin-bottom:1rem;">
                    ➕ Créer une famille
                </button>
                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:1rem;">
                    <hr style="flex:1; border:none; border-top:1px solid var(--border-color);">
                    <span style="font-size:0.75rem; color:var(--text-secondary);">OU</span>
                    <hr style="flex:1; border:none; border-top:1px solid var(--border-color);">
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <input type="text" id="familyCodeInput" maxlength="6" placeholder="CODE" style="flex:1; padding:0.65rem; border:1px solid var(--border-color); border-radius:8px; font-family:monospace; font-size:1rem; text-align:center; text-transform:uppercase; background:var(--bg-tertiary); color:var(--text-primary);">
                    <button onclick="joinFamily()" style="background:var(--bg-tertiary); color:var(--accent); border:1px solid var(--accent); padding:0.65rem 1rem; border-radius:8px; cursor:pointer; font-family:inherit; font-weight:600; font-size:0.85rem;">
                        Rejoindre
                    </button>
                </div>
                <p id="familyJoinError" style="color:#dc2626; font-size:0.8rem; margin-top:0.5rem; display:none;"></p>
            </div>
        `;
    }
}

async function createFamily() {
    try {
        const res = await fetch('/api/family', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-telegram-init-data': telegramInitData,
                'x-telegram-user-id': telegramUserId
            }
        });
        const data = await res.json();
        if (res.ok) {
            await loadFamily();
            renderFamilyModalContent();
        } else {
            alert(data.error || 'Erreur');
        }
    } catch (err) {
        alert('Erreur de connexion.');
    }
}

async function joinFamily() {
    const codeInput = document.getElementById('familyCodeInput');
    const errorEl = document.getElementById('familyJoinError');
    const code = (codeInput?.value || '').trim().toUpperCase();

    if (code.length !== 6) {
        if (errorEl) { errorEl.textContent = 'Le code doit faire 6 caractères.'; errorEl.style.display = 'block'; }
        return;
    }

    try {
        const res = await fetch('/api/family/join', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-telegram-init-data': telegramInitData,
                'x-telegram-user-id': telegramUserId
            },
            body: JSON.stringify({ code })
        });
        const data = await res.json();
        if (res.ok) {
            await loadFamily();
            renderFamilyModalContent();
            loadDashboard();
            loadTransactions();
        } else {
            if (errorEl) { errorEl.textContent = data.error || 'Erreur'; errorEl.style.display = 'block'; }
        }
    } catch (err) {
        if (errorEl) { errorEl.textContent = 'Erreur de connexion.'; errorEl.style.display = 'block'; }
    }
}

async function leaveFamily() {
    const msg = familyInfo?.isOwner
        ? 'Supprimer la famille ? Tous les membres seront déconnectés.'
        : 'Quitter la famille ? Vous ne verrez plus les données partagées.';
    if (!confirm(msg)) return;

    try {
        const res = await fetch('/api/family/leave', {
            method: 'DELETE',
            headers: {
                'x-telegram-init-data': telegramInitData,
                'x-telegram-user-id': telegramUserId
            }
        });
        if (res.ok) {
            await loadFamily();
            renderFamilyModalContent();
            loadDashboard();
            loadTransactions();
        }
    } catch (err) {
        alert('Erreur de connexion.');
    }
}

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

        // Affiche le bouton "Installer" si l'API addToHomeScreen est disponible
        if (typeof tg.addToHomeScreen === 'function') {
            const addBtn = document.getElementById('addHomeBtn');
            if (addBtn) addBtn.style.display = 'inline-block';
        }
    } else {
        // L'app est ouverte hors Telegram (navigateur classique = mode développement)
        console.warn('⚠️ Telegram WebApp non détecté - mode développement');
        useFallbackMode();
    }
}

/**
 * Ajoute l'app à l'écran d'accueil via l'API Telegram.
 */
function addToHomeScreen() {
    if (window.Telegram && Telegram.WebApp && typeof Telegram.WebApp.addToHomeScreen === 'function') {
        Telegram.WebApp.addToHomeScreen();
    } else {
        alert('Cette fonctionnalité nécessite une version récente de Telegram.');
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
                borderColor: 'var(--bg-primary)',   // Crée des séparations nettes
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
    // (utilise les variables globales currentMonth/currentYear pour être cohérent avec la vue)
    let spentThisMonth = 0;

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
        const authHeaders = {
            'x-telegram-init-data': telegramInitData,
            'x-telegram-user-id': telegramUserId
        };

        const monthParams = `month=${currentMonth}&year=${currentYear}`;

        let prevMonth = currentMonth - 1;
        let prevYear = currentYear;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear--;
        }
        const prevMonthParams = `month=${prevMonth}&year=${prevYear}`;

        const [summaryRes, prevSummaryRes, catRes, budgetRes, pendingRes] = await Promise.all([
            fetch(`/api/summary?${monthParams}`, { headers: authHeaders }),
            fetch(`/api/summary?${prevMonthParams}`, { headers: authHeaders }),
            fetch(`/api/categories-summary?${monthParams}`, { headers: authHeaders }),
            fetch('/api/budgets', { headers: authHeaders }),
            fetch(`/api/pending-recurring?${monthParams}`, { headers: authHeaders })
        ]);

        const responses = [
            { name: 'summary', res: summaryRes },
            { name: 'prevSummary', res: prevSummaryRes },
            { name: 'categories', res: catRes },
            { name: 'budgets', res: budgetRes },
            { name: 'pending', res: pendingRes }
        ];

        for (const { name, res } of responses) {
            if (!res.ok) {
                let errorText = '';
                try {
                    errorText = await res.text();
                } catch {
                    errorText = 'Impossible de lire la réponse serveur';
                }
                throw new Error(`HTTP ${res.status} on ${name} - ${errorText}`);
            }
        }

        const summary = await summaryRes.json();
        const prevSummary = await prevSummaryRes.json();
        const categories = await catRes.json();
        const budgets = await budgetRes.json();
        const pending = await pendingRes.json();

        const safeSummary = {
            totalIncome: parseFloat(summary?.totalIncome) || 0,
            totalExpenses: parseFloat(summary?.totalExpenses) || 0,
            balance: parseFloat(summary?.balance) || 0
        };

        const safePrevSummary = {
            totalIncome: parseFloat(prevSummary?.totalIncome) || 0,
            totalExpenses: parseFloat(prevSummary?.totalExpenses) || 0,
            balance: parseFloat(prevSummary?.balance) || 0
        };

        const safeCategories = Array.isArray(categories) ? categories : [];
        const safeBudgets = Array.isArray(budgets) ? budgets : [];
        const safePending = Array.isArray(pending) ? pending : [];

        userBudgets = {};
        safeBudgets.forEach(b => {
            userBudgets[b.category] = parseFloat(b.monthly_limit) || 0;
        });

        document.getElementById('totalIncome').textContent = formatAmount(safeSummary.totalIncome);
        document.getElementById('totalExpenses').textContent = formatAmount(safeSummary.totalExpenses);
        document.getElementById('balance').textContent = formatAmount(safeSummary.balance);

        const balanceCard = document.getElementById('balanceCard');
        if (safeSummary.balance < 0) {
            balanceCard.classList.add('negative');
        } else {
            balanceCard.classList.remove('negative');
        }

        const globalCard = document.getElementById('globalBudgetCard');
        let totalBudgetLimit = 0;

        safeBudgets.forEach(b => {
            totalBudgetLimit += parseFloat(b.monthly_limit) || 0;
        });

        if (totalBudgetLimit > 0) {
            globalCard.style.display = 'block';

            const totalExpenses = safeSummary.totalExpenses;
            const percentageRaw = (totalExpenses / totalBudgetLimit) * 100;
            const percentageText = percentageRaw.toFixed(1);
            const barWidth = Math.max(0, Math.min(percentageRaw, 100)).toFixed(1);

            document.getElementById('globalBudgetSpent').textContent = formatAmount(totalExpenses);
            document.getElementById('globalBudgetLimit').textContent = formatAmount(totalBudgetLimit);
            document.getElementById('globalBudgetPct').textContent = `${percentageText}%`;

            const bar = document.getElementById('globalBudgetBar');
            const pctEl = document.getElementById('globalBudgetPct');
            const statusText = document.getElementById('globalBudgetStatusText');

            if (bar) bar.style.width = `${barWidth}%`;

            if (percentageRaw >= 100) {
                if (bar) bar.style.backgroundColor = 'var(--color-expense)';
                if (pctEl) pctEl.style.color = 'var(--color-expense)';
                if (statusText) {
                    statusText.textContent = 'Dépassement !';
                    statusText.style.color = 'var(--color-expense)';
                }
            } else if (percentageRaw >= 85) {
                if (bar) bar.style.backgroundColor = '#f59e0b';
                if (pctEl) pctEl.style.color = '#f59e0b';
                if (statusText) {
                    statusText.textContent = 'Attention, budget presque atteint';
                    statusText.style.color = '#f59e0b';
                }
            } else {
                if (bar) bar.style.backgroundColor = 'var(--accent)';
                if (pctEl) pctEl.style.color = 'var(--accent)';
                if (statusText) {
                    statusText.textContent = 'Budget respecté';
                    statusText.style.color = 'var(--text-secondary)';
                }
            }
        } else {
            globalCard.style.display = 'none';
        }

        const compBar = document.getElementById('comparisonBar');
        if (safePrevSummary.totalIncome > 0 || safePrevSummary.totalExpenses > 0) {
            compBar.style.display = 'flex';

            const incDiff = safeSummary.totalIncome - safePrevSummary.totalIncome;
            const expDiff = safeSummary.totalExpenses - safePrevSummary.totalExpenses;

            const compIncome = document.getElementById('compIncome');
            const compExpense = document.getElementById('compExpense');

            if (incDiff > 0) {
                compIncome.textContent = 'Revenus ▲ ' + formatAmount(incDiff);
                compIncome.className = 'comp-item positive';
            } else if (incDiff < 0) {
                compIncome.textContent = 'Revenus ▼ ' + formatAmount(Math.abs(incDiff));
                compIncome.className = 'comp-item negative';
            } else {
                compIncome.textContent = 'Revenus =';
                compIncome.className = 'comp-item neutral';
            }

            if (expDiff > 0) {
                compExpense.textContent = 'Dépenses ▲ ' + formatAmount(expDiff);
                compExpense.className = 'comp-item negative';
            } else if (expDiff < 0) {
                compExpense.textContent = 'Dépenses ▼ ' + formatAmount(Math.abs(expDiff));
                compExpense.className = 'comp-item positive';
            } else {
                compExpense.textContent = 'Dépenses =';
                compExpense.className = 'comp-item neutral';
            }
        } else {
            compBar.style.display = 'none';
        }

        const pendingSection = document.getElementById('pendingSection');
        if (safePending.length > 0) {
            pendingSection.style.display = 'block';
            document.getElementById('pendingBadge').textContent = safePending.length;

            document.getElementById('pendingList').innerHTML = safePending.map(tx => `
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
            document.getElementById('pendingList').innerHTML = '';
        }

        displayCategories(safeCategories, safeSummary.totalExpenses);

        await loadGoal();
        loadPharmacieCard(safeCategories, safeSummary);

    } catch (err) {
        console.error('Erreur chargement dashboard:', err);

        let message = 'Erreur lors du chargement du tableau de bord.';

        if (String(err.message).includes('401')) {
            message = 'Session Telegram expirée. Fermez puis rouvrez la Mini App.';
        } else if (String(err.message).includes('429')) {
            message = 'Trop de requêtes envoyées. Attendez quelques secondes.';
        } else if (String(err.message).includes('500')) {
            message = 'Erreur serveur. Réessayez dans un instant.';
        }

        alert(message + '\n\nDÉTAIL ERREUR :\n' + (err.stack || err.message));
    }
}

/**
 * Affiche le tableau de bord budget avec limites journalières.
 * @param {Array} categories - [{category, total}] — dépenses par catégorie ce mois
 * @param {number} totalExpenses - Total pour le graphique
 */
function displayCategories(categories, totalExpenses) {
    updateChart(categories || [], parseFloat(totalExpenses) || 0);

    const container = document.getElementById('categoriesList');
    if (!container) return;

    // Séparation : catégories avec et sans budget
    const withBudget = (categories || []).filter(c => userBudgets[c.category] > 0);
    const withoutBudget = (categories || []).filter(c => !userBudgets[c.category]);

    // Catégories ayant un budget mais sans dépense ce mois
    const budgetKeys = Object.keys(userBudgets);
    const spentKeys = (categories || []).map(c => c.category);
    const notYetSpent = budgetKeys.filter(k => !spentKeys.includes(k));

    // Jours du mois pour la limite journalière
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];
    const isCurrentMonthView = (
        currentMonth === (new Date().getMonth() + 1) &&
        currentYear === new Date().getFullYear()
    );

    // Calcule les dépenses d'aujourd'hui par catégorie depuis allTransactions
    function spentToday(category) {
        if (!isCurrentMonthView) return 0;
        return allTransactions
            .filter(tx => tx.type === 'expense' &&
                tx.category === category &&
                String(tx.date).substring(0, 10) === todayStr)
            .reduce((s, tx) => s + parseFloat(tx.amount), 0);
    }

    // Génère une ligne de tableau pour une catégorie avec budget
    function buildBudgetRow(category, monthTotal) {
        const total = parseFloat(monthTotal) || 0;
        const limit = userBudgets[category];
        const dailyLimit = limit / daysInMonth;
        const todaySpent = spentToday(category);
        const monthPct = Math.min((total / limit) * 100, 100);

        // Statut journalier
        let statusBadge, rowClass;
        if (!isCurrentMonthView) {
            // Vue d'un mois passé : statut basé sur le mois entier
            const overMonth = total > limit;
            statusBadge = overMonth
                ? '<span class="budget-status-badge badge-over">Dépassé</span>'
                : '<span class="budget-status-badge badge-ok">Respecté</span>';
            rowClass = overMonth ? 'row-over' : 'row-ok';
        } else if (todaySpent > dailyLimit) {
            statusBadge = '<span class="budget-status-badge badge-over">🔴 Dépassé</span>';
            rowClass = 'row-over';
        } else if (todaySpent > dailyLimit * 0.75) {
            statusBadge = '<span class="budget-status-badge badge-warn">⚠️ Attention</span>';
            rowClass = 'row-warn';
        } else {
            statusBadge = '<span class="budget-status-badge badge-ok">✅ OK</span>';
            rowClass = 'row-ok';
        }

        // Couleur barre mensuelle
        const barColor = monthPct >= 100 ? '#ef4444'
            : monthPct >= 85 ? '#f59e0b'
                : 'var(--accent)';

        return `
        <tr class="budget-table-row ${rowClass}">
            <td class="bt-cat">
                <span class="bt-cat-name">${category}</span>
            </td>
            <td class="bt-num">${formatAmount(limit)}</td>
            <td class="bt-num bt-daily">${formatAmount(Math.round(dailyLimit))}</td>
            <td class="bt-num ${todaySpent > dailyLimit ? 'bt-over' : ''}">${formatAmount(todaySpent)}</td>
            <td class="bt-progress-cell">
                <div class="bt-bar-wrap">
                    <div class="bt-bar" style="width:${monthPct.toFixed(1)}%; background:${barColor};"></div>
                </div>
                <span class="bt-pct">${monthPct.toFixed(0)}%</span>
            </td>
            <td class="bt-status">${statusBadge}</td>
        </tr>`;
    }

    // Aucune données et aucun budget
    if (withBudget.length === 0 && notYetSpent.length === 0 && withoutBudget.length === 0) {
        container.innerHTML = '<p class="empty-message">Aucune dépense ce mois.</p>';
        return;
    }

    // Combine toutes les lignes avec budget
    const allBudgetRows = [
        ...withBudget.map(c => buildBudgetRow(c.category, c.total)),
        ...notYetSpent.map(k => buildBudgetRow(k, 0))
    ].join('');

    const hasBudgetRows = withBudget.length > 0 || notYetSpent.length > 0;
    const dayLabel = isCurrentMonthView ? `Auj. (${todayStr.split('-')[2]}/${todayStr.split('-')[1]})` : '—';

    container.innerHTML = `
        ${hasBudgetRows ? `
        <div class="budget-table-wrap">
            <table class="budget-table">
                <thead>
                    <tr>
                        <th class="bt-cat">Catégorie</th>
                        <th class="bt-num">Limite/mois</th>
                        <th class="bt-num bt-daily">Limite/jour</th>
                        <th class="bt-num">${dayLabel}</th>
                        <th class="bt-progress-cell">Ce mois</th>
                        <th class="bt-status">Statut</th>
                    </tr>
                </thead>
                <tbody>
                    ${allBudgetRows}
                </tbody>
            </table>
        </div>` : ''}

        ${withoutBudget.length > 0 ? `
        <div style="margin-top:${hasBudgetRows ? '1rem' : '0'};">
            <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:600; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:0.5rem;">
                Sans budget défini
            </div>
            ${withoutBudget.map(cat => `
            <div class="category-item" style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; border-bottom:1px solid var(--border);">
                <span style="font-size:0.88rem; color:var(--text-primary);">${cat.category}</span>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="font-weight:600; font-size:0.9rem;">${formatAmount(parseFloat(cat.total))}</span>
                    <button onclick="openBudgetModal()" style="font-size:0.7rem; padding:0.15rem 0.45rem; background:var(--bg-tertiary); border:1px dashed var(--accent); color:var(--accent); border-radius:4px; cursor:pointer; font-family:inherit;">
                        + Définir
                    </button>
                </div>
            </div>`).join('')}
        </div>` : ''}
    `;
}
// =========================================
// CARTE PHARMACIE
// =========================================

/**
 * Gère l'affichage de la carte Pharmacie
 * @param {Array} categories - Dépenses par catégorie
 * @param {Object} summary - Totaux revenus/dépenses
 */
async function loadPharmacieCard(categories, summary) {
    const pharmacieCard = document.getElementById('pharmacieCard');
    if (!pharmacieCard || !telegramUserId) return;

    try {
        // Pour éviter les race conditions avec allTransactions, on fetch
        const response = await fetch(`/api/transactions?month=${currentMonth}&year=${currentYear}`, {
            headers: {
                'x-telegram-init-data': telegramInitData,
                'x-telegram-user-id': telegramUserId
            }
        });

        let pharmacieTotal = 0;
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
                pharmacieTotal = data
                    .filter(tx => tx.category === 'Pharmacie' && tx.type === 'income')
                    .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
            }
        }

        const isCurrentMonthView = (
            currentMonth === (new Date().getMonth() + 1) &&
            currentYear === new Date().getFullYear()
        );

        const pharmacieTotalEl = document.getElementById('pharmacieTotal');
        if (pharmacieTotalEl) pharmacieTotalEl.textContent = formatAmount(pharmacieTotal);

        const deficitBadge = document.getElementById('pharmacieDeficitBadge');
        const deficitIcon = document.getElementById('pharmacieDeficitIcon');
        const deficitText = document.getElementById('pharmacieDeficitText');
        const dailyTargetEl = document.getElementById('pharmacieDailyTarget');

        // Le déficit c'est le manque à gagner si on ne comptait PAS la pharmacie
        const incomeWithoutPharma = summary.totalIncome - pharmacieTotal;
        const deficitToCover = summary.totalExpenses - incomeWithoutPharma;

        if (deficitToCover <= 0) {
            // Pas de déficit
            if (deficitBadge) deficitBadge.className = 'deficit-badge deficit-surplus';
            if (deficitIcon) deficitIcon.textContent = '🥳';
            if (deficitText) deficitText.textContent = 'Budget équilibré (sans besoin de pharmacie) !';
            if (dailyTargetEl) {
                dailyTargetEl.textContent = '0 Ar';
                dailyTargetEl.style.color = 'var(--text-secondary)';
            }
        } else {
            // Il y a un déficit à combler
            const remainingToCover = deficitToCover - pharmacieTotal;

            if (remainingToCover <= 0) {
                // Comblé !
                if (deficitBadge) deficitBadge.className = 'deficit-badge deficit-surplus';
                if (deficitIcon) deficitIcon.textContent = '✅';
                if (deficitText) deficitText.textContent = `Déficit comblé ! (${formatAmount(Math.abs(remainingToCover))} de surplus)`;
                if (dailyTargetEl) {
                    dailyTargetEl.textContent = '0 Ar';
                    dailyTargetEl.style.color = 'var(--text-secondary)';
                }
            } else {
                // Reste à gagner
                if (deficitBadge) deficitBadge.className = 'deficit-badge deficit-alert';
                if (deficitIcon) deficitIcon.textContent = '⚠️';
                if (deficitText) deficitText.textContent = `Déficit restant: ${formatAmount(remainingToCover)}`;

                if (dailyTargetEl) {
                    if (isCurrentMonthView) {
                        const today = new Date();
                        const lastDay = new Date(currentYear, currentMonth, 0).getDate();
                        let daysLeft = lastDay - today.getDate() + 1;
                        if (daysLeft < 1) daysLeft = 1;

                        const dailyNeeded = remainingToCover / daysLeft;
                        dailyTargetEl.textContent = formatAmount(Math.ceil(dailyNeeded));
                        dailyTargetEl.style.color = '#dc2626';
                    } else {
                        dailyTargetEl.textContent = '—';
                        dailyTargetEl.style.color = 'var(--text-secondary)';
                    }
                }
            }
        }
    } catch (err) {
        console.error('Erreur loadPharmacieCard:', err);
    }
}

// =========================================
// HISTORIQUE DES TRANSACTIONS — TABLEAU AVANCÉ
// =========================================

// État des filtres et du tri
let txFilter = { type: 'all', category: '' };
let txSort = 'date-desc';
let selectedTxIds = new Set();

/**
 * Charge et affiche toutes les transactions de l'utilisateur.
 */
async function loadTransactions() {
    if (!telegramUserId) return;

    const tbody = document.getElementById('transactionsList');

    try {
        const response = await fetch(
            `/api/transactions?month=${currentMonth}&year=${currentYear}`,
            {
                headers: {
                    'x-telegram-init-data': telegramInitData,
                    'x-telegram-user-id': telegramUserId
                }
            }
        );

        if (!response.ok) {
            let errorText = '';
            try { errorText = await response.text(); } catch { errorText = ''; }
            throw new Error(`HTTP ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        allTransactions = Array.isArray(data) ? data : [];

        // Peuple le filtre catégorie
        populateCategoryFilter();

        // Réinitialise la sélection
        selectedTxIds.clear();
        updateSelectionBar();

        // Affiche avec les filtres courants
        applyTxFilters();

    } catch (err) {
        console.error('Erreur chargement transactions:', err);
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="tx-empty">❌ Erreur de chargement.</td></tr>`;
    }
}

/**
 * Peuple dynamiquement le <select> de filtre catégorie.
 */
function populateCategoryFilter() {
    const sel = document.getElementById('txCategoryFilter');
    if (!sel) return;
    const cats = [...new Set(allTransactions.map(tx => tx.category))].sort();
    sel.innerHTML = '<option value="">Toutes catégories</option>' +
        cats.map(c => `<option value="${c}"${txFilter.category === c ? ' selected' : ''}>${c}</option>`).join('');
}

/**
 * Définit un filtre (type ou category) et re-render.
 */
function setTxFilter(key, value, btn) {
    txFilter[key] = value;
    if (key === 'type' && btn) {
        document.querySelectorAll('#txTypePills .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    selectedTxIds.clear();
    updateSelectionBar();
    applyTxFilters();
}

/**
 * Définit le tri et re-render.
 */
function setTxSort(value) {
    txSort = value;
    applyTxFilters();
}

/**
 * Applique les filtres et le tri, puis affiche le tableau.
 */
function applyTxFilters() {
    let txs = [...allTransactions];

    // Filtre type
    if (txFilter.type === 'income') txs = txs.filter(t => t.type === 'income');
    if (txFilter.type === 'expense') txs = txs.filter(t => t.type === 'expense');

    // Filtre catégorie
    if (txFilter.category) txs = txs.filter(t => t.category === txFilter.category);

    // Tri
    txs.sort((a, b) => {
        if (txSort === 'date-desc') return new Date(b.date) - new Date(a.date);
        if (txSort === 'date-asc') return new Date(a.date) - new Date(b.date);
        if (txSort === 'amount-desc') return parseFloat(b.amount) - parseFloat(a.amount);
        if (txSort === 'amount-asc') return parseFloat(a.amount) - parseFloat(b.amount);
        return 0;
    });

    displayTransactions(txs);
}

/**
 * Affiche les transactions comme des lignes de tableau <tr>.
 */
function displayTransactions(transactions) {
    const tbody = document.getElementById('transactionsList');
    if (!tbody) return;

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="tx-empty">Aucune transaction pour ce filtre.</td></tr>';
        document.getElementById('txSelectAll').checked = false;
        return;
    }

    tbody.innerHTML = transactions.map(tx => {
        const isIncome = tx.type === 'income';
        const sign = isIncome ? '+' : '-';
        const amountClass = isIncome ? 'tx-amount-income' : 'tx-amount-expense';
        const rowClass = isIncome ? 'tx-row-income' : 'tx-row-expense';
        const dateStr = String(tx.date).substring(0, 10);
        const [y, m, d] = dateStr.split('-');
        const formattedDate = `${d}/${m}/${y}`;
        const checked = selectedTxIds.has(tx.id) ? 'checked' : '';
        const selectedClass = selectedTxIds.has(tx.id) ? 'tx-row-selected' : '';
        const recurBadge = tx.is_recurring
            ? '<span class="tx-recur-badge" title="Récurrent">🔄</span>'
            : '';

        return `
        <tr class="tx-table-row ${rowClass} ${selectedClass}" id="tx-row-${tx.id}">
            <td class="tx-td-check">
                <input type="checkbox" class="tx-checkbox" onchange="toggleTxSelect(${tx.id}, this)" ${checked}>
            </td>
            <td class="tx-td-date">${formattedDate}</td>
            <td class="tx-td-cat">
                <span class="tx-cat-pill ${isIncome ? 'pill-income' : 'pill-expense'}">${tx.category}</span>
            </td>
            <td class="tx-td-desc">${recurBadge}${tx.description || '—'}</td>
            <td class="tx-td-amount ${amountClass}">${sign}${formatAmount(tx.amount)}</td>
            <td class="tx-td-actions">
                <button class="btn-action btn-edit-tx" onclick="openEditModal(${tx.id})" title="Modifier">
                    <img src="icons/action-edit.svg" alt="Modifier" width="16" height="16">
                </button>
                <button class="btn-action btn-delete-tx" onclick="deleteTransaction(${tx.id})" title="Supprimer">
                    <img src="icons/action-delete.svg" alt="Supprimer" width="16" height="16">
                </button>
            </td>
        </tr>`;
    }).join('');
}

/**
 * Coche/décoche une ligne et met à jour la barre de sélection.
 */
function toggleTxSelect(id, checkbox) {
    if (checkbox.checked) {
        selectedTxIds.add(id);
        document.getElementById(`tx-row-${id}`)?.classList.add('tx-row-selected');
    } else {
        selectedTxIds.delete(id);
        document.getElementById(`tx-row-${id}`)?.classList.remove('tx-row-selected');
    }
    updateSelectionBar();
}

/**
 * Coche/décoche toutes les lignes visibles.
 */
function toggleSelectAll(masterCheckbox) {
    const checkboxes = document.querySelectorAll('#transactionsList .tx-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = masterCheckbox.checked;
        const id = parseInt(cb.closest('tr').id.replace('tx-row-', ''));
        if (masterCheckbox.checked) {
            selectedTxIds.add(id);
            cb.closest('tr')?.classList.add('tx-row-selected');
        } else {
            selectedTxIds.delete(id);
            cb.closest('tr')?.classList.remove('tx-row-selected');
        }
    });
    updateSelectionBar();
}

/**
 * Met à jour la barre de sélection (affiche le bouton de suppression).
 */
function updateSelectionBar() {
    const bar = document.getElementById('txSelectionBar');
    const count = document.getElementById('txSelectionCount');
    if (!bar) return;
    if (selectedTxIds.size > 0) {
        bar.classList.remove('hidden');
        count.textContent = `${selectedTxIds.size} sélectionné(s)`;
    } else {
        bar.classList.add('hidden');
    }
}

/**
 * Supprime toutes les transactions sélectionnées en une seule requête.
 */
async function bulkDeleteTransactions() {
    if (selectedTxIds.size === 0) return;
    const n = selectedTxIds.size;
    if (!confirm(`Supprimer ${n} transaction${n > 1 ? 's' : ''} ? Cette action est irréversible.`)) return;

    try {
        const response = await fetch('/api/transactions/bulk', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-telegram-init-data': telegramInitData,
                'x-telegram-user-id': telegramUserId
            },
            body: JSON.stringify({ ids: [...selectedTxIds] })
        });

        if (response.ok) {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
            selectedTxIds.clear();
            loadTransactions();
            loadDashboard();
        } else {
            const err = await response.json();
            alert('❌ ' + (err.error || 'Erreur lors de la suppression.'));
        }
    } catch {
        alert('❌ Erreur de connexion.');
    }
}

// Compatibilité : filterHistory() est conservé pour les anciens appels
function filterHistory(filter, btn) {
    setTxFilter('type', filter, btn);
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
// GAINS PHARMACIE
// =========================================

function openPharmacieModal() {
    const dateInput = document.getElementById('pharmacieDate');
    dateInput.value = new Date().toISOString().split('T')[0];
    document.getElementById('pharmacieAmount').value = '';
    document.getElementById('pharmacieMessage').className = 'form-message hidden';
    document.getElementById('pharmacieBackdrop').classList.add('active');
    document.getElementById('pharmacieModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePharmacieModal() {
    document.getElementById('pharmacieBackdrop').classList.remove('active');
    document.getElementById('pharmacieModal').classList.remove('active');
    document.body.style.overflow = '';
}

async function submitPharmacieGain() {
    const amount = document.getElementById('pharmacieAmount').value;
    const date = document.getElementById('pharmacieDate').value;
    const msgEl = document.getElementById('pharmacieMessage');
    const btn = document.getElementById('pharmacieSubmitBtn');

    if (!amount || parseFloat(amount) <= 0) {
        msgEl.textContent = 'Veuillez entrer un montant valide.';
        msgEl.className = 'form-message error';
        return;
    }
    if (!date) {
        msgEl.textContent = 'Veuillez choisir une date.';
        msgEl.className = 'form-message error';
        return;
    }

    btn.disabled = true;
    btn.textContent = '⏳...';

    try {
        const response = await fetch('/api/transactions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-telegram-init-data': telegramInitData,
                'x-telegram-user-id': telegramUserId
            },
            body: JSON.stringify({
                type: 'income',
                amount: parseFloat(amount),
                category: 'Pharmacie',
                description: 'Gain journalier pharmacie',
                date,
                is_recurring: false
            })
        });

        if (response.ok) {
            closePharmacieModal();
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
            loadDashboard();
            loadTransactions();
        } else {
            const data = await response.json();
            msgEl.textContent = '❌ ' + (data.error || 'Erreur serveur.');
            msgEl.className = 'form-message error';
        }
    } catch (err) {
        msgEl.textContent = '❌ Erreur de connexion.';
        msgEl.className = 'form-message error';
    }

    btn.disabled = false;
    btn.textContent = '💊 Enregistrer';
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

        if (Array.isArray(goals) && goals.length > 0) {
            const goal = goals[0]; // Prend le plus récent
            currentGoalId = goal.id;

            goalCard.style.display = 'block';
            btnCreate.style.display = 'none';

            document.getElementById('goalName').textContent = goal.name;
            document.getElementById('goalTarget').textContent = formatAmount(goal.target_amount);
            document.getElementById('goalSaved').textContent = formatAmount(goal.current_amount);

            const pctRaw = goal.target_amount > 0
                ? (goal.current_amount / goal.target_amount) * 100
                : 0;
            const pct = Math.min(pctRaw, 100).toFixed(1);

            document.getElementById('goalName').textContent = goal.name;
            document.getElementById('goalTarget').textContent = formatAmount(goal.target_amount);
            document.getElementById('goalSaved').textContent = formatAmount(goal.current_amount);
            document.getElementById('goalPct').textContent = pct + '%';
            document.getElementById('goalBar').style.width = pct + '%';

            // Message de motivation selon l'avancement
            const remaining = goal.target_amount - goal.current_amount;
            const motivEl = document.getElementById('goalMotivation');
            if (motivEl) {
                if (pctRaw >= 100) {
                    motivEl.textContent = '🎉 Objectif atteint ! Félicitations !';
                    motivEl.style.color = '#059669';
                } else if (pctRaw >= 75) {
                    motivEl.textContent = `🔥 Plus que ${formatAmount(remaining)} — vous y êtes presque !`;
                    motivEl.style.color = '#d97706';
                } else if (pctRaw >= 50) {
                    motivEl.textContent = `💪 À mi-chemin ! Encore ${formatAmount(remaining)} à épargner.`;
                    motivEl.style.color = 'var(--accent)';
                } else if (pctRaw > 0) {
                    motivEl.textContent = `🌱 Bon départ ! Il reste ${formatAmount(remaining)} à atteindre.`;
                    motivEl.style.color = 'var(--text-secondary)';
                } else {
                    motivEl.textContent = `🎯 Chaque Ariary compte ! Objectif : ${formatAmount(goal.target_amount)}`;
                    motivEl.style.color = 'var(--text-secondary)';
                }
            }
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
