// ============================================================
// HISTORIAL DE FONEMAS (evaluaciones guardadas en localStorage)
// ============================================================

const PHONEME_HISTORY_KEY = 'phoneme_history';
const phonemeHistoryList = document.getElementById('phoneme-history-list');
const phonemeHistoryClearBtn = document.getElementById('phoneme-history-clear-btn');

function loadPhonemeHistory() {
  try {
    const raw = localStorage.getItem(PHONEME_HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function savePhonemeHistory(list) {
  localStorage.setItem(PHONEME_HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
}

function addPhonemeHistoryEntry(entry) {
  const list = loadPhonemeHistory();
  list.unshift({ ...entry, date: new Date().toISOString() });
  savePhonemeHistory(list);
  renderPhonemeHistory();
}

function clearPhonemeHistory() {
  localStorage.removeItem(PHONEME_HISTORY_KEY);
  renderPhonemeHistory();
}

function renderPhonemeHistory() {
  if (!phonemeHistoryList) return;
  const list = loadPhonemeHistory();
  phonemeHistoryList.innerHTML = '';

  if (!list.length) {
    phonemeHistoryList.innerHTML = '<p class="hint">Aún no hay evaluaciones registradas. Practica un sonido y aparecerá aquí.</p>';
    return;
  }

  list.forEach((entry) => {
    const div = document.createElement('div');
    div.className = 'phoneme-history-row';
    const date = new Date(entry.date);
    const dateStr = date.toLocaleDateString('es', { day: '2-digit', month: 'short' }) + ' ' +
      date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    const missed = entry.missed && entry.missed.length ? entry.missed.join(', ') : null;

    div.innerHTML = `
      <span class="ph-score ${scoreClass(entry.score)}">${entry.score}</span>
      <div class="phoneme-history-info">
        <span class="phoneme-history-name">${escapeHtml(entry.phoneme || '—')}</span>
        ${missed ? `<span class="phoneme-history-missed">Falladas: ${escapeHtml(missed)}</span>` : ''}
      </div>
      <span class="phoneme-history-date">${dateStr}</span>
    `;
    phonemeHistoryList.appendChild(div);
  });
}

phonemeHistoryClearBtn.addEventListener('click', () => {
  if (confirm('¿Vaciar el historial de fonemas?')) {
    clearPhonemeHistory();
    showToast('Historial de fonemas vaciado.', 'info');
  }
});

renderPhonemeHistory();

// ============================================================
// RESULTADOS DE EJERCICIOS (gramática y vocabulario) — datos
