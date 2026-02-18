/**
 * Main App — роутинг, инициализация экранов, обработка событий.
 */

const App = {

    /** Текущий активный экран */
    currentScreen: 'dashboard',

    /** Текущий фильтр истории */
    historyFilter: 'all',
    historySearch: '',
    historyOffset: 0,
    historyLimit: 20,

    /** Выбранный период аналитики */
    analyticsPeriod: 'month',

    /** Состояние bottom sheet */
    sheetOpen: false,
    selectedCategoryId: null,
    txType: 'expense',

    // ══════════════════════════ Инициализация ══════════════════════════

    async init() {
        // Инициализация Telegram SDK
        TG.init();

        // Загрузка данных
        await API.init();

        // Настраиваем обработчики
        this._setupTabBar();
        this._setupFAB();
        this._setupBottomSheet();
        this._setupFilters();
        this._setupSearch();
        this._setupAnalyticsPeriod();
        this._setupSettings();

        // Рендерим начальный экран
        this.renderDashboard();

        // Устанавливаем дату по умолчанию в форме
        const dateInput = Utils.$('txDate');
        if (dateInput) dateInput.value = Utils.todayISO();
    },

    // ══════════════════════════ Роутинг ══════════════════════════

    navigate(screen) {
        if (screen === this.currentScreen) return;

        TG.hapticSelection();

        // Скрываем все экраны
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

        // Показываем нужный
        const el = Utils.$(`screen-${screen}`);
        if (el) el.classList.add('active');

        // Обновляем tab bar
        document.querySelectorAll('.tab-item').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === screen);
        });

        // FAB показываем только на dashboard и history
        const fab = Utils.$('fabAdd');
        if (fab) {
            fab.classList.toggle('hidden', screen === 'settings');
        }

        this.currentScreen = screen;

        // Рендерим экран
        switch (screen) {
            case 'dashboard': this.renderDashboard(); break;
            case 'history': this.renderHistory(); break;
            case 'analytics': this.renderAnalytics(); break;
            case 'settings': this.renderSettings(); break;
        }

        // BackButton
        if (screen !== 'dashboard') {
            TG.showBackButton(() => this.navigate('dashboard'));
        } else {
            TG.hideBackButton();
        }
    },

    // ══════════════════════════ Dashboard ══════════════════════════

    renderDashboard() {
        const currency = API.getCurrency();

        // Баланс с count-up анимацией
        const balanceEl = Utils.$('balanceAmount');
        if (balanceEl) {
            Utils.countUp(balanceEl, API.getBalance(), 500, v => Utils.formatAmount(v, currency));
        }

        // Доходы/расходы за текущий месяц
        const monthStart = Utils.monthStartISO();
        const incomeEl = Utils.$('heroIncome');
        const expenseEl = Utils.$('heroExpense');
        if (incomeEl) incomeEl.textContent = `+${Utils.formatShort(API.getIncome(monthStart))}`;
        if (expenseEl) expenseEl.textContent = `-${Utils.formatShort(API.getExpense(monthStart))}`;

        // In Pocket
        const inPocketEl = Utils.$('inPocketAmount');
        if (inPocketEl) {
            const ip = API.getInPocket();
            inPocketEl.textContent = `${Utils.formatAmount(ip, currency)}/день`;
        }

        // Последние транзакции
        this._renderTransactionList(
            Utils.$('recentTransactions'),
            API.getRecent(5),
            true
        );
    },

    // ══════════════════════════ History ══════════════════════════

    renderHistory() {
        this.historyOffset = 0;
        const list = API.getFiltered(this.historyFilter, this.historySearch);
        const visible = list.slice(0, this.historyLimit);

        this._renderTransactionList(Utils.$('historyList'), visible, false);

        // Кнопка «Загрузить ещё»
        const btn = Utils.$('loadMoreBtn');
        if (btn) {
            btn.style.display = list.length > this.historyLimit ? 'block' : 'none';
            btn.onclick = () => this._loadMoreHistory(list);
        }
    },

    _loadMoreHistory(fullList) {
        this.historyOffset += this.historyLimit;
        const next = fullList.slice(this.historyOffset, this.historyOffset + this.historyLimit);

        const container = Utils.$('historyList');
        for (const tx of next) {
            container.appendChild(this._createTransactionItem(tx));
        }

        const btn = Utils.$('loadMoreBtn');
        if (btn && this.historyOffset + this.historyLimit >= fullList.length) {
            btn.style.display = 'none';
        }
    },

    // ══════════════════════════ Analytics ══════════════════════════

    renderAnalytics() {
        const now = new Date();
        let dateFrom;

        switch (this.analyticsPeriod) {
            case 'week':
                dateFrom = new Date(now);
                dateFrom.setDate(now.getDate() - now.getDay() + 1);
                dateFrom.setHours(0, 0, 0, 0);
                break;
            case 'quarter':
                dateFrom = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                break;
            case 'month':
            default:
                dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
        }

        const from = dateFrom.toISOString();
        const currency = API.getCurrency();

        // Stats grid
        const income = API.getIncome(from);
        const expense = API.getExpense(from);
        const avg = API.getAvgDaily();
        const count = API.getCount(from);

        const statIncome = Utils.$('statIncome');
        const statExpense = Utils.$('statExpense');
        const statAvg = Utils.$('statAvgDaily');
        const statCount = Utils.$('statCount');

        if (statIncome) statIncome.textContent = Utils.formatShort(income);
        if (statExpense) statExpense.textContent = Utils.formatShort(expense);
        if (statAvg) statAvg.textContent = Utils.formatShort(avg);
        if (statCount) statCount.textContent = count;

        // Donut chart
        const catStats = API.getCategoryStats(from);
        Charts.drawDonut(
            Utils.$('donutCanvas'),
            catStats,
            Utils.$('donutLegend')
        );

        // Bar chart — помесячная статистика
        const barData = this._getMonthlyBarData();
        Charts.drawBar(Utils.$('barCanvas'), barData);
    },

    _getMonthlyBarData() {
        const months = [];
        const now = new Date();
        const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
                            'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

            months.push({
                label: monthNames[d.getMonth()],
                income: API.getIncome(d.toISOString(), end.toISOString()),
                expense: API.getExpense(d.toISOString(), end.toISOString()),
            });
        }

        return months;
    },

    // ══════════════════════════ Settings ══════════════════════════

    renderSettings() {
        // Валюта
        const currVal = Utils.$('settingCurrencyValue');
        if (currVal) currVal.textContent = API.getCurrency();

        // Дайджест
        const digestToggle = Utils.$('digestToggle');
        if (digestToggle) digestToggle.checked = API.getWeeklyDigest();

        // Категории
        this._renderCategoriesGrid(Utils.$('categoriesGrid'), API.getCategories());
    },

    // ══════════════════════════ Bottom Sheet ══════════════════════════

    openSheet() {
        TG.hapticImpact('medium');
        this.sheetOpen = true;
        this.selectedCategoryId = null;
        this.txType = 'expense';

        Utils.$('overlay')?.classList.add('visible');
        Utils.$('addSheet')?.classList.add('open');

        // Сбрасываем форму
        const amountInput = Utils.$('txAmount');
        if (amountInput) { amountInput.value = ''; amountInput.focus(); }
        Utils.$('txComment').value = '';
        Utils.$('txDate').value = Utils.todayISO();

        // Рендерим категории для выбранного типа
        this._renderSheetCategories();

        // Сбрасываем сегмент
        document.querySelectorAll('#txTypeSegment .segment-item').forEach(s => {
            s.classList.toggle('active', s.dataset.type === 'expense');
        });

        // MainButton
        TG.showMainButton('Сохранить', () => this._saveTransaction());
    },

    closeSheet() {
        this.sheetOpen = false;
        Utils.$('overlay')?.classList.remove('visible');
        Utils.$('addSheet')?.classList.remove('open');
        TG.hideMainButton();
    },

    async _saveTransaction() {
        const amountInput = Utils.$('txAmount');
        const amount = parseFloat(amountInput?.value);

        if (!amount || amount <= 0) {
            TG.hapticNotification('error');
            amountInput?.classList.add('shake');
            setTimeout(() => amountInput?.classList.remove('shake'), 400);
            return;
        }

        TG.setMainButtonLoading(true);

        const finalAmount = this.txType === 'income' ? amount : -amount;
        const comment = Utils.$('txComment')?.value || '';
        const date = Utils.$('txDate')?.value || null;

        await API.addTransaction(
            finalAmount,
            this.selectedCategoryId || 10,
            comment,
            date ? new Date(date).toISOString() : null
        );

        TG.hapticNotification('success');
        TG.setMainButtonLoading(false);

        this.closeSheet();

        // Обновляем текущий экран
        if (this.currentScreen === 'dashboard') this.renderDashboard();
        if (this.currentScreen === 'history') this.renderHistory();
        if (this.currentScreen === 'analytics') this.renderAnalytics();
    },

    _renderSheetCategories() {
        const container = Utils.$('txCategories');
        if (!container) return;

        const type = this.txType === 'income' ? 'income' : 'expense';
        const cats = API.getCategoriesByType(type);

        container.innerHTML = cats.map(cat => `
            <div class="category-item ${this.selectedCategoryId === cat.id ? 'selected' : ''}"
                 data-cat-id="${cat.id}">
                <span class="category-icon">${cat.icon}</span>
                <span class="category-name">${cat.name}</span>
            </div>
        `).join('');

        // Обработчики выбора
        container.querySelectorAll('.category-item').forEach(el => {
            el.addEventListener('click', () => {
                TG.hapticSelection();
                this.selectedCategoryId = parseInt(el.dataset.catId);
                container.querySelectorAll('.category-item').forEach(c => c.classList.remove('selected'));
                el.classList.add('selected');
            });
        });
    },

    // ══════════════════════════ Рендер-хелперы ══════════════════════════

    _renderTransactionList(container, transactions, compact) {
        if (!container) return;

        if (!transactions.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📭</span>
                    <p>Нет транзакций</p>
                    ${compact ? '<p class="empty-hint">Нажмите + чтобы добавить</p>' : ''}
                </div>`;
            return;
        }

        container.innerHTML = '';
        let currentDate = '';

        for (const tx of transactions) {
            const dateLabel = Utils.formatDate(tx.date);
            if (dateLabel !== currentDate) {
                currentDate = dateLabel;
                const dateEl = document.createElement('div');
                dateEl.className = 'transaction-group-date';
                dateEl.textContent = dateLabel;
                container.appendChild(dateEl);
            }

            container.appendChild(this._createTransactionItem(tx));
        }
    },

    _createTransactionItem(tx) {
        const el = document.createElement('div');
        el.className = 'transaction-item slide-up';
        el.dataset.txId = tx.id;

        const isIncome = tx.amount > 0;
        const sign = isIncome ? '+' : '';
        const amountClass = isIncome ? 'income' : 'expense';
        const currency = API.getCurrency();

        el.innerHTML = `
            <div class="transaction-icon">${tx.categoryIcon || '📦'}</div>
            <div class="transaction-info">
                <div class="transaction-name">${tx.description || tx.categoryName || '—'}</div>
                <div class="transaction-category">${tx.categoryName || ''}</div>
            </div>
            <div class="transaction-amount ${amountClass}">
                ${sign}${Utils.formatAmount(Math.abs(tx.amount), currency)}
            </div>
            <div class="transaction-delete">Удалить</div>
        `;

        // Swipe to delete
        this._setupSwipe(el, tx.id);

        return el;
    },

    _setupSwipe(el, txId) {
        let startX = 0;
        let swiped = false;

        el.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            swiped = false;
        }, { passive: true });

        el.addEventListener('touchmove', (e) => {
            const diff = startX - e.touches[0].clientX;
            if (diff > 60 && !swiped) {
                swiped = true;
                el.classList.add('swiped');
                TG.hapticImpact('medium');
            }
        }, { passive: true });

        // Нажатие на кнопку удаления
        el.querySelector('.transaction-delete')?.addEventListener('click', () => {
            TG.showConfirm('Удалить транзакцию?', async (confirmed) => {
                if (confirmed) {
                    el.classList.add('slide-out');
                    TG.hapticNotification('success');
                    setTimeout(async () => {
                        await API.deleteTransaction(txId);
                        el.remove();
                        this.renderDashboard();
                    }, 300);
                } else {
                    el.classList.remove('swiped');
                }
            });
        });

        // Клик вне — сбросить swipe
        el.addEventListener('click', (e) => {
            if (swiped && !e.target.closest('.transaction-delete')) {
                el.classList.remove('swiped');
                swiped = false;
            }
        });
    },

    _renderCategoriesGrid(container, categories) {
        if (!container) return;

        container.innerHTML = categories.map(cat => `
            <div class="category-item">
                <span class="category-icon">${cat.icon}</span>
                <span class="category-name">${cat.name}</span>
            </div>
        `).join('');
    },

    // ══════════════════════════ Setup обработчиков ══════════════════════════

    _setupTabBar() {
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.addEventListener('click', () => this.navigate(tab.dataset.tab));
        });

        // Кнопка «Все →» на dashboard
        document.querySelectorAll('.section-action[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => this.navigate(btn.dataset.tab));
        });
    },

    _setupFAB() {
        Utils.$('fabAdd')?.addEventListener('click', () => this.openSheet());
    },

    _setupBottomSheet() {
        // Закрытие по overlay
        Utils.$('overlay')?.addEventListener('click', () => this.closeSheet());

        // Переключение типа
        document.querySelectorAll('#txTypeSegment .segment-item').forEach(btn => {
            btn.addEventListener('click', () => {
                TG.hapticSelection();
                this.txType = btn.dataset.type;
                document.querySelectorAll('#txTypeSegment .segment-item').forEach(
                    s => s.classList.toggle('active', s === btn)
                );
                this._renderSheetCategories();
            });
        });
    },

    _setupFilters() {
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                TG.hapticSelection();
                this.historyFilter = chip.dataset.filter;
                document.querySelectorAll('.filter-chip').forEach(
                    c => c.classList.toggle('active', c === chip)
                );
                this.renderHistory();
            });
        });
    },

    _setupSearch() {
        const input = Utils.$('searchInput');
        if (!input) return;

        input.addEventListener('input', Utils.debounce(() => {
            this.historySearch = input.value;
            this.renderHistory();
        }, 300));
    },

    _setupAnalyticsPeriod() {
        document.querySelectorAll('#analyticsPeriod .segment-item').forEach(btn => {
            btn.addEventListener('click', () => {
                TG.hapticSelection();
                this.analyticsPeriod = btn.dataset.period;
                document.querySelectorAll('#analyticsPeriod .segment-item').forEach(
                    s => s.classList.toggle('active', s === btn)
                );
                this.renderAnalytics();
            });
        });
    },

    _setupSettings() {
        // Валюта — циклическое переключение
        const currencies = ['UZS', 'USD', 'EUR', 'RUB'];
        Utils.$('settingCurrency')?.addEventListener('click', async () => {
            TG.hapticSelection();
            const current = API.getCurrency();
            const idx = currencies.indexOf(current);
            const next = currencies[(idx + 1) % currencies.length];
            await API.setCurrency(next);
            this.renderSettings();
        });

        // Дайджест
        Utils.$('digestToggle')?.addEventListener('change', async (e) => {
            TG.hapticSelection();
            await API.setWeeklyDigest(e.target.checked);
        });

        // Экспорт — отправляем команду в бот
        Utils.$('settingExportXlsx')?.addEventListener('click', () => {
            TG.hapticImpact('light');
            TG.sendData({ action: 'export', format: 'xlsx' });
            TG.showAlert('Запрос на экспорт отправлен в бот.');
        });

        Utils.$('settingExportCsv')?.addEventListener('click', () => {
            TG.hapticImpact('light');
            TG.sendData({ action: 'export', format: 'csv' });
            TG.showAlert('Запрос на CSV-экспорт отправлен в бот.');
        });
    },
};

// ══════════════════════════ Запуск ══════════════════════════

document.addEventListener('DOMContentLoaded', () => App.init());
