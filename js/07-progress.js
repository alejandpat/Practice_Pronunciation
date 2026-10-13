// ============================================================
// PROGRESO (gráficos con Chart.js)
// ============================================================

let progressChart = null;
const skillCharts = { pronunciation: null, grammar: null, vocabulary: null };
const SKILL_CHART_DEFS = [
  { key: 'pronunciation', canvasId: 'skill-chart-pronunciation', label: 'Pronunciación', color: '#6c8cff', rgba: 'rgba(108, 140, 255, 0.15)' },
  { key: 'grammar', canvasId: 'skill-chart-grammar', label: 'Gramática', color: '#4caf7d', rgba: 'rgba(76, 175, 125, 0.15)' },
  { key: 'vocabulary', canvasId: 'skill-chart-vocabulary', label: 'Vocabulario', color: '#b388ff', rgba: 'rgba(179, 136, 255, 0.15)' }
];

function renderProgress() {
  // Solo sesiones de práctica con puntuaciones, en orden cronológico
  let practiceSessions = loadHistory()
    .filter((e) => e.scores)
    .slice() // copia
    .reverse(); // más antiguas primero

  // Filtro por nivel
  const levelFilter = progressLevelFilter.value;
  if (levelFilter !== 'all') {
    practiceSessions = practiceSessions.filter((e) => e.level === levelFilter);
  }

  if (!practiceSessions.length || typeof Chart === 'undefined') {
    progressSummary.innerHTML = '';
    progressChartCanvas.parentElement.style.display = 'none';
    progressEmpty.style.display = 'block';
    return;
  }

  progressChartCanvas.parentElement.style.display = 'block';
  progressEmpty.style.display = 'none';

  // Etiquetas: fecha corta de cada sesión
  const labels = practiceSessions.map((s) => {
    const d = new Date(s.date);
    return d.toLocaleDateString('es', { day: '2-digit', month: 'short' }) +
      ' ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  });

  const pronData = practiceSessions.map((s) => s.scores.pronunciation ?? null);
  const gramData = practiceSessions.map((s) => s.scores.grammar ?? null);
  const vocabData = practiceSessions.map((s) => s.scores.vocabulary ?? null);

  // Resumen: promedio de las primeras 3 vs últimas 3 sesiones
  const avg = (arr) => {
    const valid = arr.filter((v) => v != null);
    return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
  };

  const firstN = practiceSessions.slice(0, Math.min(3, practiceSessions.length));
  const lastN = practiceSessions.slice(-Math.min(3, practiceSessions.length));

  const stats = [
    { label: '🔊 Pronunciación', first: avg(firstN.map((s) => s.scores.pronunciation)), last: avg(lastN.map((s) => s.scores.pronunciation)) },
    { label: '📚 Gramática', first: avg(firstN.map((s) => s.scores.grammar)), last: avg(lastN.map((s) => s.scores.grammar)) },
    { label: '💡 Vocabulario', first: avg(firstN.map((s) => s.scores.vocabulary)), last: avg(lastN.map((s) => s.scores.vocabulary)) }
  ];

  progressSummary.innerHTML = '';
  stats.forEach((stat) => {
    const div = document.createElement('div');
    div.className = 'progress-stat';

    let deltaHtml = '';
    if (stat.first != null && stat.last != null) {
      const delta = stat.last - stat.first;
      if (delta > 0) {
        div.classList.add('stat-delta-up');
        deltaHtml = `<div class="stat-delta stat-delta-up">▲ +${delta} respecto al inicio</div>`;
      } else if (delta < 0) {
        deltaHtml = `<div class="stat-delta stat-delta-down">▼ ${delta} respecto al inicio</div>`;
      } else {
        deltaHtml = `<div class="stat-delta stat-delta-flat">— sin cambio</div>`;
      }
    }

    div.innerHTML = `
      <div class="stat-label">${stat.label}</div>
      <div class="stat-value">${stat.last ?? '--'}</div>
      ${deltaHtml}
    `;
    progressSummary.appendChild(div);
  });

  // Gráfico de líneas
  if (progressChart) progressChart.destroy();

  progressChart = new Chart(progressChartCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Pronunciación',
          data: pronData,
          borderColor: '#6c8cff',
          backgroundColor: 'rgba(108, 140, 255, 0.15)',
          tension: 0.3,
          fill: true
        },
        {
          label: 'Gramática',
          data: gramData,
          borderColor: '#4caf7d',
          backgroundColor: 'rgba(76, 175, 125, 0.15)',
          tension: 0.3,
          fill: true
        },
        {
          label: 'Vocabulario',
          data: vocabData,
          borderColor: '#b388ff',
          backgroundColor: 'rgba(179, 136, 255, 0.15)',
          tension: 0.3,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: { color: '#9aa3c0' },
          grid: { color: 'rgba(42, 48, 80, 0.5)' }
        },
        x: {
          ticks: { color: '#9aa3c0', maxRotation: 45 },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { labels: { color: '#e8eaf6' } }
      }
    }
  });

  // Gráficos individuales por habilidad (mismos datos y filtros)
  renderSkillCharts(practiceSessions, labels);

  // Gráficos de resultados de ejercicios (gramática/vocabulario)
  renderExerciseCharts();
}

// Ajustar el tamaño de los gráficos al abrir su subsección colapsable
// (Chart.js renderiza con tamaño 0 si el contenedor estaba oculto)
document.querySelectorAll('details.chart-collapse').forEach((details) => {
  details.addEventListener('toggle', () => {
    if (!details.open) return;
    const canvas = details.querySelector('canvas');
    if (!canvas) return;
    const chart = Chart.getChart ? Chart.getChart(canvas) : null;
    if (chart) chart.resize();
  });
});

function renderSkillCharts(sessions, labels) {
  SKILL_CHART_DEFS.forEach((def) => {
    const canvas = document.getElementById(def.canvasId);
    if (!canvas) return;

    if (skillCharts[def.key]) skillCharts[def.key].destroy();

    const skillData = sessions.map((s) => (s.scores ? s.scores[def.key] ?? null : null));

    skillCharts[def.key] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: def.label,
            data: skillData,
            borderColor: def.color,
            backgroundColor: def.rgba,
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { color: '#9aa3c0' },
            grid: { color: 'rgba(42, 48, 80, 0.5)' }
          },
          x: {
            ticks: { color: '#9aa3c0', maxRotation: 45 },
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  });
}

