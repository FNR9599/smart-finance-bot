/**
 * Charts — Premium Canvas charts (без внешних библиотек).
 * Donut chart и Bar chart с градиентами и тенями.
 */

const Charts = {

    /** Цвета в стиле Apple */
    COLORS: [
        '#FF9500', '#FF3B30', '#AF52DE', '#FF2D55',
        '#5856D6', '#007AFF', '#34C759', '#30D158',
        '#FF6961', '#8E8E93'
    ],

    /**
     * Рисование donut chart — Premium.
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

        // Очистка
        ctx.clearRect(0, 0, size, size);

        const cx = size / 2;
        const cy = size / 2;
        const outerR = 120;
        const innerR = 78;
        const total = data.reduce((s, d) => s + d.total, 0);
        const gap = 0.02; // Gap between segments (radians)

        let startAngle = -Math.PI / 2;

        // Тень под графиком
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.01)';
        ctx.fill();
        ctx.restore();

        // Рисуем сегменты с зазорами
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const sliceAngle = (item.total / total) * Math.PI * 2;
            const adjustedStart = startAngle + gap / 2;
            const adjustedEnd = startAngle + sliceAngle - gap / 2;

            if (sliceAngle > gap) {
                ctx.beginPath();
                ctx.arc(cx, cy, outerR, adjustedStart, adjustedEnd);
                ctx.arc(cx, cy, innerR, adjustedEnd, adjustedStart, true);
                ctx.closePath();

                // Градиент для каждого сегмента
                const midAngle = (adjustedStart + adjustedEnd) / 2;
                const gx1 = cx + Math.cos(midAngle) * innerR;
                const gy1 = cy + Math.sin(midAngle) * innerR;
                const gx2 = cx + Math.cos(midAngle) * outerR;
                const gy2 = cy + Math.sin(midAngle) * outerR;

                const grad = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
                grad.addColorStop(0, item.color);
                grad.addColorStop(1, this._lightenColor(item.color, 20));

                ctx.fillStyle = grad;
                ctx.fill();
            }

            startAngle += sliceAngle;
        }

        // Внутренний круг — белый с тенью для глубины
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, innerR - 1, 0, Math.PI * 2);
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--card-bg').trim() || '#fff';
        ctx.fill();
        ctx.restore();

        // Текст в центре — сумма
        const textColor = getComputedStyle(document.body).getPropertyValue('--text-primary').trim() || '#000';
        const subColor = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#666';

        ctx.fillStyle = textColor;
        ctx.font = '700 24px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Utils.formatShort(total), cx, cy - 10);

        ctx.fillStyle = subColor;
        ctx.font = '500 13px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(API.getCurrency(), cx, cy + 12);

        // Легенда — с процентами
        if (legendEl) {
            legendEl.innerHTML = data.map(item => {
                const pct = ((item.total / total) * 100).toFixed(0);
                return `<div class="legend-item">
                    <span class="legend-dot" style="background:${item.color}"></span>
                    ${item.icon} ${item.name} · ${pct}%
                </div>`;
            }).join('');
        }

        canvas.parentElement?.classList.add('chart-appear');
    },

    /**
     * Рисование bar chart — Premium с градиентами.
     */
    drawBar(canvas, data) {
        if (!data.length) {
            this._drawEmpty(canvas, 'Нет данных');
            return;
        }

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const w = Math.min(600, window.innerWidth - 64);
        const h = 260;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.scale(dpr, dpr);

        // Очистка
        ctx.clearRect(0, 0, w, h);

        const padding = { top: 28, right: 16, bottom: 40, left: 16 };
        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;

        const maxVal = Math.max(
            ...data.map(d => Math.max(d.income, d.expense)),
            1
        );

        const barGroupWidth = chartW / data.length;
        const barWidth = Math.min(barGroupWidth * 0.28, 28);
        const gap = barGroupWidth * 0.1;

        const textColor = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#8E8E93';
        const lineColor = getComputedStyle(document.body).getPropertyValue('--separator').trim() || 'rgba(0,0,0,0.05)';

        // Горизонтальные линии-гайды (пунктирные)
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        for (let i = 0; i <= 3; i++) {
            const y = padding.top + (chartH / 3) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // Бары с градиентами и скруглёнными углами
        for (let i = 0; i < data.length; i++) {
            const x = padding.left + i * barGroupWidth + (barGroupWidth - barWidth * 2 - 6) / 2;

            // Доход (зелёный градиент)
            const incomeH = Math.max((data[i].income / maxVal) * chartH, 0);
            const incomeY = padding.top + chartH - incomeH;

            const incGrad = ctx.createLinearGradient(0, incomeY, 0, incomeY + incomeH);
            incGrad.addColorStop(0, '#34C759');
            incGrad.addColorStop(1, '#30D158');

            ctx.save();
            ctx.shadowColor = 'rgba(52, 199, 89, 0.2)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 2;
            this._drawRoundedBar(ctx, x, incomeY, barWidth, incomeH, 6, incGrad);
            ctx.restore();

            // Расход (красный градиент)
            const expenseH = Math.max((data[i].expense / maxVal) * chartH, 0);
            const expenseY = padding.top + chartH - expenseH;

            const expGrad = ctx.createLinearGradient(0, expenseY, 0, expenseY + expenseH);
            expGrad.addColorStop(0, '#FF3B30');
            expGrad.addColorStop(1, '#FF6961');

            ctx.save();
            ctx.shadowColor = 'rgba(255, 59, 48, 0.2)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 2;
            this._drawRoundedBar(ctx, x + barWidth + 6, expenseY, barWidth, expenseH, 6, expGrad);
            ctx.restore();

            // Подпись месяца
            ctx.fillStyle = textColor;
            ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(
                data[i].label,
                padding.left + i * barGroupWidth + barGroupWidth / 2,
                h - padding.bottom + 20
            );
        }

        // Легенда сверху — pill-style
        const legendY = 12;

        // Доходы
        this._drawPill(ctx, padding.left, legendY - 8, 70, 18, 'rgba(52, 199, 89, 0.12)');
        ctx.fillStyle = '#34C759';
        ctx.beginPath();
        ctx.arc(padding.left + 10, legendY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#34C759';
        ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Доходы', padding.left + 18, legendY + 4);

        // Расходы
        this._drawPill(ctx, padding.left + 78, legendY - 8, 76, 18, 'rgba(255, 59, 48, 0.12)');
        ctx.fillStyle = '#FF3B30';
        ctx.beginPath();
        ctx.arc(padding.left + 88, legendY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FF3B30';
        ctx.fillText('Расходы', padding.left + 96, legendY + 4);

        canvas.parentElement?.classList.add('chart-appear');
    },

    /**
     * Нарисовать скруглённый бар с градиентом.
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
     * Нарисовать pill (закруглённый прямоугольник).
     */
    _drawPill(ctx, x, y, w, h, color) {
        const r = h / 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    },

    /**
     * Осветлить цвет.
     */
    _lightenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return `rgb(${R}, ${G}, ${B})`;
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

        ctx.clearRect(0, 0, 280, 200);

        // Иконка
        ctx.font = '40px -apple-system';
        ctx.textAlign = 'center';
        ctx.fillText('📊', 140, 80);

        // Текст
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-tertiary').trim() || '#C7C7CC';
        ctx.font = '500 14px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(text, 140, 115);

        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-tertiary').trim() || '#C7C7CC';
        ctx.font = '400 12px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText('Добавьте транзакции', 140, 138);
    }
};
