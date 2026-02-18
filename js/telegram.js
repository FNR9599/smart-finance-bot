/**
 * Telegram WebApp SDK wrapper.
 * Инициализация, haptic feedback, MainButton, BackButton, CloudStorage.
 */

const TG = {
    /** Telegram WebApp объект */
    app: window.Telegram?.WebApp,

    /** Инициализация Mini App */
    init() {
        if (!this.app) {
            console.warn('Telegram WebApp SDK недоступен — режим разработки');
            return;
        }

        this.app.ready();
        this.app.expand();

        // Устанавливаем цвета из темы
        document.documentElement.style.setProperty('--tg-bg', this.app.backgroundColor);

        // Активируем BackButton по умолчанию скрытой
        if (this.app.BackButton) {
            this.app.BackButton.hide();
        }
    },

    /** Получить данные пользователя */
    getUser() {
        return this.app?.initDataUnsafe?.user || null;
    },

    /** Получить initData для валидации на сервере */
    getInitData() {
        return this.app?.initData || '';
    },

    // ── Haptic Feedback ──

    /** Тактильная обратная связь — лёгкий удар */
    hapticImpact(style = 'medium') {
        try {
            this.app?.HapticFeedback?.impactOccurred(style);
        } catch (e) { /* не критично */ }
    },

    /** Тактильная обратная связь — уведомление */
    hapticNotification(type = 'success') {
        try {
            this.app?.HapticFeedback?.notificationOccurred(type);
        } catch (e) { /* не критично */ }
    },

    /** Тактильная обратная связь — выбор */
    hapticSelection() {
        try {
            this.app?.HapticFeedback?.selectionChanged();
        } catch (e) { /* не критично */ }
    },

    // ── MainButton ──

    /** Показать MainButton */
    showMainButton(text, callback) {
        if (!this.app?.MainButton) return;

        this.app.MainButton.setText(text);
        this.app.MainButton.show();
        this.app.MainButton.onClick(callback);
    },

    /** Скрыть MainButton */
    hideMainButton() {
        if (!this.app?.MainButton) return;
        this.app.MainButton.hide();
        this.app.MainButton.offClick();
    },

    /** Включить/выключить загрузку на MainButton */
    setMainButtonLoading(loading) {
        if (!this.app?.MainButton) return;
        if (loading) {
            this.app.MainButton.showProgress();
        } else {
            this.app.MainButton.hideProgress();
        }
    },

    // ── BackButton ──

    /** Показать BackButton */
    showBackButton(callback) {
        if (!this.app?.BackButton) return;
        this.app.BackButton.show();
        this.app.BackButton.onClick(callback);
    },

    /** Скрыть BackButton */
    hideBackButton() {
        if (!this.app?.BackButton) return;
        this.app.BackButton.hide();
        this.app.BackButton.offClick();
    },

    // ── Data ──

    /** Отправить данные в бот через sendData */
    sendData(data) {
        if (!this.app) {
            console.log('sendData (dev):', data);
            return;
        }
        this.app.sendData(JSON.stringify(data));
    },

    /** Нативный алерт */
    showAlert(message) {
        if (this.app?.showAlert) {
            this.app.showAlert(message);
        } else {
            alert(message);
        }
    },

    /** Нативный confirm */
    showConfirm(message, callback) {
        if (this.app?.showConfirm) {
            this.app.showConfirm(message, callback);
        } else {
            callback(confirm(message));
        }
    },

    // ── Cloud Storage ──

    /** Сохранить в CloudStorage */
    async cloudSet(key, value) {
        return new Promise((resolve) => {
            if (this.app?.CloudStorage) {
                this.app.CloudStorage.setItem(key, JSON.stringify(value), (err) => {
                    resolve(!err);
                });
            } else {
                localStorage.setItem(key, JSON.stringify(value));
                resolve(true);
            }
        });
    },

    /** Прочитать из CloudStorage */
    async cloudGet(key) {
        return new Promise((resolve) => {
            if (this.app?.CloudStorage) {
                this.app.CloudStorage.getItem(key, (err, value) => {
                    if (err || !value) {
                        resolve(null);
                    } else {
                        try { resolve(JSON.parse(value)); }
                        catch { resolve(null); }
                    }
                });
            } else {
                try {
                    const v = localStorage.getItem(key);
                    resolve(v ? JSON.parse(v) : null);
                } catch { resolve(null); }
            }
        });
    },

    /** Закрыть Mini App */
    close() {
        if (this.app) {
            this.app.close();
        }
    }
};
