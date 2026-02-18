/**
 * Charts — рисование графиков на Canvas (без внешних библиотек).
 * Donut chart и Bar chart в Apple-стиле.
 */

const Charts = {

    /**
     * Рисование donut chart.
     * @param {HTMLCanvasElement} canvas
     * @param {Array} data — [{name, icon, color, total}]
     * @param {HTMLElement} legendEl — контейнер для легенды
     */
    drawDonut(canvas, data, legendEl) {
        if (!data.length) {
            this._drawEmpty(canvas, 'Нет данных');
            if (legendEl) legendEl.innerHTML = '';
            return;
        }

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const size = 280;

        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        ctx.scale(dpr, dpr);

        const cx = size / 2;
        const cy = size / 2;
        const outerR = 120;
        const innerR = 75;
        const total = data.reduce((s, d) => s + d.total, 0);

        let startAngle = -Math.PI / 2;

        // Рисуем сегменты
        for (const item of data) {
            const sliceAngle = (item.total / total) * Math.PI * 2;
            const endAngle = startAngle + sliceAngle;

            ctx.beginPath();
            ctx.arc(cx, cy, outerR, startAngle, endAngle);
            ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
            ctx.closePath();
            ctx.fillStyle = item.color;
            ctx.fill();

            startAngle = endAngle;
        }

        // Тень в центре для глубины
        const gradient = ctx.createRadialGradient(cx, cy, innerR - 5, cx, cy, innerR + 5);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.03)');
        ctx.beginPath();
        ctx.arc(cx, cy, innerR + 5, 0, Math.PI * 2);
        ctx.arc(cx, cy, innerR - 5, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Текст в центре
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-primary').trim() || '#000';
        ctx.font = '700 22px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Utils.formatShort(total), cx, cy - 8);

        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#666';
        ctx.font = '500 12px -apple-system, sans-serif';
        ctx.fillText(API.getCurrency(), cx, cy + 12);

        // Легенда
        if (legendEl) {
            legendEl.innerHTML = data.map(item => {
                const pct = ((item.total / total) * 100).toFixed(0);
                return `<div class="legend-item">
                    <span class="legend-dot" style="background:${item.color}"></span>
                    ${item.icon} ${item.name} (${pct}%)
                </div>`;
            }).join('');
        }

        // Анимация появления
        canvas.parentElement?.classList.add('chart-appear');
    },

    /**
     * Рисование bar chart (доходы vs расходы).
     * @param {HTMLCanvasElement} canvas
     * @param {Array} data — [{label, income, expense}]
     */
    drawBar(canvas, data) {
        if (!data.length) {
            this._drawEmpty(canvas, 'Нет данных');
            return;
        }

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const w = Math.min(600, window.innerWidth - 64);
        const h = 250;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.scale(dpr, dpr);

        const padding = { top: 20, right: 16, bottom: 36, left: 16 };
        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;

        const maxVal = Math.max(
            ...data.map(d => Math.max(d.income, d.expense)),
            1
        );

        const barGroupWidth = chartW / data.length;
        const barWidth = barGroupWidth * 0.3;
        const gap = barGroupWidth * 0.1;

        const textColor = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#666';

        // Горизонтальные линии-гайды
        ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();
        }

        // Бары
        for (let i = 0; i < data.length; i++) {
            const x = padding.left + i * barGroupWidth;

            // Доход (зелёный)
            const incomeH = (data[i].income / maxVal) * chartH;
            const incomeY = padding.top + chartH - incomeH;
            this._drawRoundedBar(ctx, x + gap, incomeY, barWidth, incomeH, 4, '#34C759');

            // Расход (красный)
            const expenseH = (data[i].expense / maxVal) * chartH;
            const expenseY = padding.top + chartH - expenseH;
            this._drawRoundedBar(ctx, x + gap + barWidth + 4, expenseY, barWidth, expenseH, 4, '#FF3B30');

            // Подпись месяца
            ctx.fillStyle = textColor;
            ctx.font = '500 11px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(
                data[i].label,
                x + barGroupWidth / 2,
                h - padding.bottom + 16
            );
        }

        // Легенда сверху
        ctx.font = '600 11px -apple-system, sans-serif';
        ctx.textAlign = 'left';

        ctx.fillStyle = '#34C759';
        ctx.beginPath();
        ctx.arc(padding.left + 6, 10, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = textColor;
        ctx.fillText('Доходы', padding.left + 14, 14);

        ctx.fillStyle = '#FF3B30';
        ctx.beginPath();
        ctx.arc(padding.left + 76, 10, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = textColor;
        ctx.fillText('Расходы', padding.left + 84, 14);

        canvas.parentElement?.classList.add('chart-appear');
    },

    /**
     * Нарисовать скруглённый бар.
     */
    _drawRoundedBar(ctx, x, y, w, h, r, color) {
        if (h <= 0) return;
        r = Math.min(r, h / 2, w / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    },

    /**
     * Пустое состояние для canvas.
     */
    _drawEmpty(canvas, text) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = 280 * dpr;
        canvas.height = 200 * dpr;
        canvas.style.width = '280px';
        canvas.style.height = '200px';
        ctx.scale(dpr, dpr);

        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-tertiary').trim() || '#999';
        ctx.font = '500 14px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(text, 140, 100);
    }
};
