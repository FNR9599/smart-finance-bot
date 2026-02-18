/**
 * Утилиты — форматирование, даты, хелперы.
 */

const Utils = {

    /**
     * Форматирование суммы с разделителями тысяч.
     * @param {number} amount
     * @param {string} currency
     * @returns {string}
     */
    formatAmount(amount, currency = 'UZS') {
        const abs = Math.abs(amount);
        let formatted;
        if (abs === Math.floor(abs)) {
            formatted = Math.floor(abs).toLocaleString('ru-RU');
        } else {
            formatted = abs.toLocaleString('ru-RU', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
        return `${formatted} ${currency}`;
    },

    /**
     * Сокращённый формат: 1.5M, 250K.
     * @param {number} value
     * @returns {string}
     */
    formatShort(value) {
        const abs = Math.abs(value);
        if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1)}M`;
        if (abs >= 100_000) return `${Math.round(abs / 1_000)}K`;
        if (abs >= 1_000) return `${(abs / 1_000).toFixed(1)}K`;
        return Math.round(abs).toString();
    },

    /**
     * Форматирование даты: "Сегодня", "Вчера", "12 фев".
     * @param {string|Date} dateStr
     * @returns {string}
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        const diff = (today - d) / 86400000;

        if (diff === 0) return 'Сегодня';
        if (diff === 1) return 'Вчера';

        const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн',
                        'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
        return `${date.getDate()} ${months[date.getMonth()]}`;
    },

    /**
     * Форматирование даты: "12.02.2026".
     * @param {string|Date} dateStr
     * @returns {string}
     */
    formatDateFull(dateStr) {
        const d = new Date(dateStr);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}.${month}.${d.getFullYear()}`;
    },

    /**
     * Получить сегодняшнюю дату в формате YYYY-MM-DD.
     * @returns {string}
     */
    todayISO() {
        const d = new Date();
        return d.toISOString().split('T')[0];
    },

    /**
     * Начало текущего месяца ISO.
     * @returns {string}
     */
    monthStartISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    },

    /**
     * Дней до конца месяца.
     * @returns {number}
     */
    daysUntilMonthEnd() {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        return Math.max(lastDay - now.getDate(), 1);
    },

    /**
     * Count-up анимация числа.
     * @param {HTMLElement} el — элемент
     * @param {number} target — конечное значение
     * @param {number} duration — длительность (мс)
     * @param {function} formatter — функция форматирования
     */
    countUp(el, target, duration = 500, formatter = null) {
        const start = 0;
        const startTime = performance.now();
        const fmt = formatter || ((v) => Utils.formatAmount(v));

        function step(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = start + (target - start) * eased;

            el.textContent = fmt(current);

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = fmt(target);
                el.classList.add('count-up');
            }
        }

        requestAnimationFrame(step);
    },

    /**
     * Debounce функция.
     * @param {function} fn
     * @param {number} delay
     * @returns {function}
     */
    debounce(fn, delay = 300) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    /**
     * Получить элемент по ID (короткий алиас).
     * @param {string} id
     * @returns {HTMLElement|null}
     */
    $(id) {
        return document.getElementById(id);
    }
};
