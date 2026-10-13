
// ============================================================
// GRÁFICOS DE RESULTADOS DE EJERCICIOS (gramática/vocabulario)
// ============================================================

let exerciseSetChart = null;
let exerciseTopicChart = null;

function renderExerciseCharts() {
  const setCanvas = document.getElementById('exercise-set-chart');
  const topicCanvas = document.getElementById('exercise-topic-chart');
  if (!setCanvas || !topicCanvas) return;

  // Mismo filtro de nivel que el resto de gráficos de Progreso
  const levelFilter = progressLevelFilter ? progressLevelFilter.value : 'all';
  const all = loadExerciseResults();
  const results = levelFilter === 'all'
    ? all
    : all.filter((r) => r.level === levelFilter);

  // ---------- Por conjunto: media diaria por tipo ----------
  const byDate = {};
  results.forEach((r) => {
    const day = r.date.slice(0, 10);
    if (!byDate[day]) byDate[day] = { grammar: [], vocabulary: [] };
    if (byDate[day][r.type]) byDate[day][r.type].push(r.score);
  });
  const days = Object.keys(byDate).sort();
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
  const vocabularyData = days.map((day) => avg(byDate[day].vocabulary));
  const grammarData = days.map((day) => avg(byDate[day].grammar));

  if (exerciseSetChart) exerciseSetChart.destroy();
  exerciseSetChart = new Chart(setCanvas, {
    type: 'line',
    data: {
      labels: days.map((d) => new Date(d + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short' })),
      datasets: [
        {
          label: '📐 Gramática',
          data: grammarData,
          borderColor: '#6c8cff',
          backgroundColor: 'rgba(108, 140, 255, 0.15)',
          tension: 0.3,
          fill: true,
          spanGaps: true
        },
        {
          label: '💡 Vocabulario',
          data: vocabularyData,
          borderColor: '#4ade80',
          backgroundColor: 'rgba(74, 222, 128, 0.15)',
          tension: 0.3,
          fill: true,
          spanGaps: true
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

  // ---------- Por temática: media por tema (barras horizontales) ----------
  const byTopic = {};
  results.forEach((r) => {
    const key = r.type + '|' + r.topic;
    if (!byTopic[key]) byTopic[key] = { type: r.type, topic: r.topic, scores: [] };
    byTopic[key].topic = r.topic;
    byTopic[key].scores.push(r.score);
  });
  const topics = Object.values(byTopic)
    .map((t) => ({ ...t, avg: Math.round(t.scores.reduce((a, b) => a + b, 0) / t.scores.length) }))
    .sort((a, b) => b.avg - a.avg);

  if (exerciseTopicChart) exerciseTopicChart.destroy();
  exerciseTopicChart = new Chart(topicCanvas, {
    type: 'bar',
    data: {
      labels: topics.map((t) => (t.type === 'grammar' ? '📐 ' : '💡 ') + t.topic),
      datasets: [
        {
          label: 'Media',
          data: topics.map((t) => t.avg),
          backgroundColor: topics.map((t) => (t.type === 'grammar' ? 'rgba(108, 140, 255, 0.7)' : 'rgba(74, 222, 128, 0.7)')),
          borderRadius: 6
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: { color: '#9aa3c0' },
          grid: { color: 'rgba(42, 48, 80, 0.5)' }
        },
        y: {
          ticks: { color: '#e8eaf6' },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

