// ============================================================
// RACHAS Y METAS DIARIAS
// ============================================================

const STREAK_KEY = 'practice_streak';
const DAILY_GOAL = 3; // sesiones de práctica por día

function loadStreakData() {
  try {
    return JSON.parse(localStorage.getItem(STREAK_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveStreakData(data) {
  localStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

// Registrar una sesión completada de una actividad.
// activity: 'practice' | 'conversation' | 'translate' | 'dictionary' | 'phonemes'
// La racha cuenta días con CUALQUIER actividad; el seguimiento es por actividad.
const ACTIVITY_LABELS = {
  practice: '📝 Práctica',
  conversation: '💬 Conversación',
  translate: '🌍 Traducción',
  dictionary: '📖 Diccionario',
  phonemes: '🔤 Fonemas',
  grammar: '📐 Gramática',
  vocabulary: '🧠 Vocabulario'
};

function recordActivitySession(activity) {
  const data = loadStreakData();
  const today = new Date().toISOString().slice(0, 10);

  if (!data.days) data.days = {};
  data.days[today] = (data.days[today] || 0) + 1;

  if (!data.activities) data.activities = {};
  if (!data.activities[activity]) data.activities[activity] = {};
  const act = data.activities[activity];
  act[today] = (act[today] || 0) + 1;

  // Calcular racha: días consecutivos con al menos 1 sesión de cualquier actividad
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (data.days[key] > 0) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  data.streak = streak;
  data.bestStreak = Math.max(data.bestStreak || 0, streak);

  saveStreakData(data);
  renderStreak();
  renderActivityTracking();
}

// Compatibilidad: la práctica sigue registrando con su nombre original
function recordPracticeSession() {
  recordActivitySession('practice');
}

// ---------- Panel de seguimiento por actividad ----------
function renderActivityTracking() {
  const container = document.getElementById('activity-tracking');
  if (!container) return;

  const data = loadStreakData();
  const today = new Date().toISOString().slice(0, 10);

  const rows = Object.keys(ACTIVITY_LABELS).map((activity) => {
    const days = (data.activities && data.activities[activity]) || {};
    const todayCount = days[today] || 0;

    // Total histórico y últimos 7 días
    let total = 0;
    for (const key in days) total += days[key];

    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      last7.push({ key, count: days[key] || 0, label: ['D', 'L', 'M', 'X', 'J', 'V', 'S'][d.getDay()] });
    }

    const marks = last7.map((d) => {
      const cls = d.count > 0 ? 'on' : '';
      const title = `${d.key}: ${d.count} sesión(es)`;
      return `<span class="day-mark ${cls}" title="${title}"></span>`;
    }).join('');

    return `
      <div class="activity-row">
        <span class="activity-name">${ACTIVITY_LABELS[activity]}</span>
        <span class="activity-count today">${todayCount} hoy</span>
        <span class="activity-count total">${total} total</span>
        <span class="activity-days">${marks}</span>
      </div>`;
  }).join('');

  container.innerHTML = rows || '<p class="hint">Aún no hay sesiones registradas.</p>';
}

function renderStreak() {
  const streakRow = document.getElementById('streak-row');
  const streakHint = document.getElementById('streak-hint');
  if (!streakRow) return;

  const data = loadStreakData();
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = (data.days && data.days[today]) || 0;
  const streak = data.streak || 0;
  const best = data.bestStreak || 0;

  // Últimos 7 días
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    last7.push({ key, count: (data.days && data.days[key]) || 0, label: ['D', 'L', 'M', 'X', 'J', 'V', 'S'][d.getDay()] });
  }

  const daysHtml = last7.map((d) => {
    const done = d.count >= DAILY_GOAL;
    const started = d.count > 0;
    const cls = done ? 'done' : started ? 'started' : '';
    return `<div class="review-stat day-dot ${cls}">
      <div class="stat-value">${done ? '🔥' : started ? '·' : '–'}</div>
      <div class="stat-label">${d.label}</div>
    </div>`;
  }).join('');

  streakRow.innerHTML = `
    <div class="review-stat">
      <div class="stat-value fire">🔥 ${streak}</div>
      <div class="stat-label">días de racha</div>
    </div>
    <div class="review-stat">
      <div class="stat-value">${todayCount}/${DAILY_GOAL}</div>
      <div class="stat-label">sesiones hoy</div>
    </div>
    <div class="review-stat">
      <div class="stat-value">🏆 ${best}</div>
      <div class="stat-label">mejor racha</div>
    </div>
    ${daysHtml}
  `;

  // Indicador compacto en el header (visible en todas las pestañas)
  const hsStreak = document.getElementById('hs-streak');
  const hsToday = document.getElementById('hs-today');
  const hsBest = document.getElementById('hs-best');
  if (hsStreak) hsStreak.textContent = streak;
  if (hsToday) hsToday.textContent = `${todayCount}/${DAILY_GOAL}`;
  if (hsBest) hsBest.textContent = best;
}

// Clic en la franja de racha del header: ir a Progreso
const headerStreak = document.getElementById('header-streak');
if (headerStreak) {
  headerStreak.addEventListener('click', () => activateTabByName('progress'));
}

// Enganchar el registro de sesión a la evaluación de pronunciación
const _originalEvaluatePronunciation = evaluatePronunciation;
evaluatePronunciation = function (...args) {
  const result = _originalEvaluatePronunciation(...args);
  recordPracticeSession();
  return result;
};

renderStreak();

