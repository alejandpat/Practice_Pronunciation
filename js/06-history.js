// ============================================================
// HISTORIAL DE PRÁCTICA
// ============================================================

// ============================================================
// NOTIFICACIONES (toast)
// ============================================================

const HISTORY_LIMIT = 100;
const HISTORY_WARNING = 90; // avisar a partir de esta cantidad

function showToast(message, type = 'info', duration = 5000) {
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 400);
  }, 5000);
}

// ============================================================
// HISTORIAL DE PRÁCTICA
// ============================================================

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem('practice_history') || '[]');
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem('practice_history', JSON.stringify(history));
}

function addHistoryEntry(entry) {
  const history = loadHistory();
  history.unshift({ ...entry, date: new Date().toISOString() });

  // Avisar cuando se acerca al límite
  if (history.length === HISTORY_WARNING) {
    showToast(`⚠️ Tu historial tiene ${HISTORY_WARNING} sesiones (límite: ${HISTORY_LIMIT}). Considera exportarlo para no perder datos.`, 'warning');
  }

  // Limitar a 100 entradas: se elimina la más antigua
  let removed = 0;
  while (history.length > HISTORY_LIMIT) {
    history.pop();
    removed++;
  }
  if (removed > 0) {
    showToast(`🗑️ Historial lleno (${HISTORY_LIMIT}). Se eliminó la sesión más antigua. Exporta tus datos para conservarlos.`, 'warning');
  }

  saveHistory(history);
}

// Exportar historial a JSON
historyExportBtn.addEventListener('click', () => {
  const history = loadHistory();
  if (!history.length) {
    showToast('No hay sesiones para exportar.', 'warning');
    return;
  }

  const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'historial-practica-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Historial exportado ✔', 'success');
});

function renderHistory() {
  const history = loadHistory();
  historyList.innerHTML = '';

  if (!history.length) {
    historyList.innerHTML = '<p class="hint">Aún no hay sesiones guardadas. ¡Haz tu primera práctica!</p>';
    return;
  }

  history.forEach((entry) => {
    const div = document.createElement('div');
    div.className = 'history-item';

    const date = new Date(entry.date);
    const dateStr = date.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

    let scoresHtml = '';
    if (entry.scores) {
      const s = entry.scores;
      scoresHtml = `
        <span class="history-score">🔊 Pronunciación: <b>${s.pronunciation ?? '--'}</b></span>
        <span class="history-score">📚 Gramática: <b>${s.grammar ?? '--'}</b></span>
        <span class="history-score">💡 Vocabulario: <b>${s.vocabulary ?? '--'}</b></span>`;
    } else if (entry.corrections != null) {
      scoresHtml = `<span class="history-score">✏️ Correcciones: <b>${entry.corrections}</b></span>`;
    }

    const LEVEL_LABELS = { beginner: '🟢', intermediate: '🟡', advanced: '🔴' };
    const levelBadge = entry.level
      ? `<span class="history-mode" title="Nivel">${LEVEL_LABELS[entry.level] || ''} ${escapeHtml(entry.level)}</span>`
      : '';

    div.innerHTML = `
      <div class="history-head">
        <span class="history-mode">${escapeHtml(entry.mode)}</span>
        ${levelBadge}
        <span class="history-date">${dateStr}</span>
      </div>
      <div class="history-text">"${escapeHtml(entry.text)}"</div>
      <div class="history-scores">${scoresHtml}</div>
    `;
    historyList.appendChild(div);
  });
}

historyClearBtn.addEventListener('click', () => {
  if (confirm('¿Seguro que quieres borrar todo el historial?')) {
    localStorage.removeItem('practice_history');
    renderHistory();
  }
});

// Redibujar el progreso al cambiar el filtro de nivel
// (referencia diferida: renderProgress se define en 07-progress.js, que carga después)
progressLevelFilter.addEventListener('change', () => renderProgress());

