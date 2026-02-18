/**
 * Data Layer — хранение данных и взаимодействие с ботом.
 * Использует CloudStorage для кэша и sendData для отправки в бот.
 */

const API = {

    /** Локальный кэш данных */
    _data: {
        transactions: [],
        categories: [],
        balance: 0,
        currency: 'UZS',
        weeklyDigest: true,
    },

    /** Категории по умолчанию */
    DEFAULT_CATEGORIES: [
        { id: 1, name: 'Еда', icon: '🍔', type: 'expense', color: '#FF9500' },
        { id: 2, name: 'Транспорт', icon: '🚕', type: 'expense', color: '#FF3B30' },
        { id: 3, name: 'Жилье', icon: '🏠', type: 'expense', color: '#AF52DE' },
        { id: 4, name: 'Покупки', icon: '🛒', type: 'expense', color: '#FF2D55' },
        { id: 5, name: 'Развлечения', icon: '🎭', type: 'expense', color: '#5856D6' },
        { id: 6, name: 'Здоровье', icon: '❤️', type: 'expense', color: '#FF2D55' },
        { id: 7, name: 'Образование', icon: '📚', type: 'expense', color: '#007AFF' },
        { id: 8, name: 'Зарплата', icon: '💰', type: 'income', color: '#34C759' },
        { id: 9, name: 'Фриланс', icon: '💸', type: 'income', color: '#30D158' },
        { id: 10, name: 'Другое', icon: '📦', type: 'both', color: '#8E8E93' },
    ],

    /** Инициализация — загрузка данных из кэша */
    async init() {
        // Загружаем категории из кэша или используем дефолтные
        const cachedCats = await TG.cloudGet('categories');
        this._data.categories = cachedCats || this.DEFAULT_CATEGORIES;

        // Загружаем транзакции из кэша
        const cachedTx = await TG.cloudGet('transactions');
        this._data.transactions = cachedTx || [];

        // Загружаем настройки
        const settings = await TG.cloudGet('settings');
        if (settings) {
            this._data.currency = settings.currency || 'UZS';
            this._data.weeklyDigest = settings.weeklyDigest !== false;
        }

        // Пересчитываем баланс
        this._recalcBalance();
    },

    // ── Транзакции ──

    /** Получить все транзакции */
    getTransactions() {
        return [...this._data.transactions].sort(
            (a, b) => new Date(b.date) - new Date(a.date)
        );
    },

    /** Получить последние N транзакций */
    getRecent(limit = 5) {
        return this.getTransactions().slice(0, limit);
    },

    /** Получить транзакции с фильтром */
    getFiltered(filter = 'all', search = '') {
        let list = this.getTransactions();

        if (filter === 'income') {
            list = list.filter(t => t.amount > 0);
        } else if (filter === 'expense') {
            list = list.filter(t => t.amount < 0);
        }

        if (search) {
            const q = search.toLowerCase();
            list = list.filter(t =>
                (t.description || '').toLowerCase().includes(q) ||
                (t.categoryName || '').toLowerCase().includes(q)
            );
        }

        return list;
    },

    /** Добавить транзакцию */
    async addTransaction(amount, categoryId, description = '', date = null) {
        const category = this._data.categories.find(c => c.id === categoryId);
        const tx = {
            id: Date.now(),
            amount: amount,
            category_id: categoryId,
            categoryName: category ? category.name : '',
            categoryIcon: category ? category.icon : '📦',
            description: description,
            source: 'webapp',
            date: date || new Date().toISOString(),
        };

        this._data.transactions.push(tx);
        this._recalcBalance();
        await this._saveTransactions();

        // Отправляем в бот
        TG.sendData({
            action: 'add_transaction',
            amount: tx.amount,
            category_id: tx.category_id,
            description: tx.description,
            date: tx.date,
        });

        return tx;
    },

    /** Удалить транзакцию */
    async deleteTransaction(txId) {
        this._data.transactions = this._data.transactions.filter(t => t.id !== txId);
        this._recalcBalance();
        await this._saveTransactions();

        // Отправляем в бот
        TG.sendData({
            action: 'delete_transaction',
            transaction_id: txId,
        });
    },

    // ── Баланс и статистика ──

    /** Текущий баланс */
    getBalance() {
        return this._data.balance;
    },

    /** Доходы за период */
    getIncome(dateFrom = null, dateTo = null) {
        return this._periodSum(t => t.amount > 0, dateFrom, dateTo);
    },

    /** Расходы за период (абсолютное значение) */
    getExpense(dateFrom = null, dateTo = null) {
        return Math.abs(this._periodSum(t => t.amount < 0, dateFrom, dateTo));
    },

    /** Статистика расходов по категориям */
    getCategoryStats(dateFrom = null, dateTo = null) {
        const txs = this._filterByDate(dateFrom, dateTo)
            .filter(t => t.amount < 0);

        const map = {};
        for (const tx of txs) {
            const catId = tx.category_id || 10;
            if (!map[catId]) {
                const cat = this._data.categories.find(c => c.id === catId) || {};
                map[catId] = {
                    id: catId,
                    name: cat.name || 'Другое',
                    icon: cat.icon || '📦',
                    color: cat.color || '#8E8E93',
                    total: 0,
                };
            }
            map[catId].total += Math.abs(tx.amount);
        }

        return Object.values(map).sort((a, b) => b.total - a.total);
    },

    /** Средний расход в день за текущий месяц */
    getAvgDaily() {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const days = Math.max(now.getDate(), 1);
        const expense = this.getExpense(start.toISOString());
        return expense / days;
    },

    /** In Pocket: безопасный расход в день */
    getInPocket() {
        const balance = this.getBalance();
        if (balance <= 0) return 0;
        return balance / Utils.daysUntilMonthEnd();
    },

    /** Количество транзакций за период */
    getCount(dateFrom = null, dateTo = null) {
        return this._filterByDate(dateFrom, dateTo).length;
    },

    // ── Категории ──

    /** Получить все категории */
    getCategories() {
        return this._data.categories;
    },

    /** Получить категории по типу */
    getCategoriesByType(type) {
        if (type === 'all') return this._data.categories;
        return this._data.categories.filter(c => c.type === type || c.type === 'both');
    },

    // ── Настройки ──

    /** Получить валюту */
    getCurrency() {
        return this._data.currency;
    },

    /** Установить валюту */
    async setCurrency(currency) {
        this._data.currency = currency;
        await this._saveSettings();
    },

    /** Получить состояние дайджеста */
    getWeeklyDigest() {
        return this._data.weeklyDigest;
    },

    /** Установить дайджест */
    async setWeeklyDigest(enabled) {
        this._data.weeklyDigest = enabled;
        await this._saveSettings();
    },

    // ── Приватные методы ──

    _recalcBalance() {
        this._data.balance = this._data.transactions.reduce(
            (sum, t) => sum + t.amount, 0
        );
    },

    _filterByDate(dateFrom, dateTo) {
        let list = this._data.transactions;
        if (dateFrom) {
            const from = new Date(dateFrom).getTime();
            list = list.filter(t => new Date(t.date).getTime() >= from);
        }
        if (dateTo) {
            const to = new Date(dateTo).getTime();
            list = list.filter(t => new Date(t.date).getTime() <= to);
        }
        return list;
    },

    _periodSum(filter, dateFrom, dateTo) {
        return this._filterByDate(dateFrom, dateTo)
            .filter(filter)
            .reduce((sum, t) => sum + t.amount, 0);
    },

    async _saveTransactions() {
        await TG.cloudSet('transactions', this._data.transactions);
    },

    async _saveSettings() {
        await TG.cloudSet('settings', {
            currency: this._data.currency,
            weeklyDigest: this._data.weeklyDigest,
        });
    },
};
