// ============================================================
// HISTORIAL DE CONVERSACIONES (persistente)
// - Auto-guardado de la conversación actual: se restaura al recargar
// - Conversaciones guardadas con nombre: se pueden retomar después
// ============================================================

const CONV_CURRENT_KEY = 'conv_current';
const CONV_SAVED_KEY = 'conv_saved_list';

const convSaveBtn = document.getElementById('conv-save-btn');
const convSavedSelect = document.getElementById('conv-saved-select');
const convLoadBtn = document.getElementById('conv-load-btn');
const convDeleteBtn = document.getElementById('conv-delete-btn');

function loadSavedConversations() {
  try {
    return JSON.parse(localStorage.getItem(CONV_SAVED_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSavedConversations(list) {
  localStorage.setItem(CONV_SAVED_KEY, JSON.stringify(list));
}

// Serializa la conversación actual (mensajes renderizados + historial del prompt)
function restoreConversation(snapshot) {
  if (!snapshot) return;

  conversationHistory = snapshot.history || [];
  convMessages.innerHTML = '';

  for (const m of snapshot.messages || []) {
    addMessage(
      m.role,
      m.text || '',
      m.corrections || [],
      m.scores && (m.scores.grammar || m.scores.vocabulary) ? m.scores : null
    );
  }

  // Restaurar escenario y modo examen si estaban activos
  if (snapshot.scenario && convScenarioSelect) convScenarioSelect.value = snapshot.scenario;
  if (snapshot.examMode && examModeSelect) examModeSelect.value = snapshot.examMode;
  updateScenarioHint();

  if (conversationHistory.length) {
    setConvStatus('Conversación restaurada. ¡Continúa donde la dejaste!');
  }
}

// ---------- Auto-guardado: la conversación actual sobrevive a recargas ----------
let convSaveTimer = null;
function autoSaveCurrentConversation() {
  clearTimeout(convSaveTimer);
  convSaveTimer = setTimeout(() => {
    if (!conversationHistory.length) return;
    localStorage.setItem(CONV_CURRENT_KEY, JSON.stringify(snapshotCurrentConversation()));
  }, 400);
}

function snapshotCurrentConversation() {
  const messages = [];
  convMessages.querySelectorAll('.message').forEach((div) => {
    const isUser = div.classList.contains('user');
    const textEl = div.querySelector('.message-text');
    const corrections = [];
    div.querySelectorAll('.message-corrections > div').forEach((c) => {
      corrections.push({
        original: c.querySelector('em')?.textContent || '',
        correction: c.querySelector('.suggestion')?.textContent || '',
        explanation: c.querySelector('.hint')?.textContent || ''
      });
    });
    const scores = {};
    div.querySelectorAll('.turn-score').forEach((chip) => {
      const g = chip.textContent.match(/Gramática:\s*(\d+)/);
      if (g) scores.grammar = { score: Number(g[1]) };
      const v = chip.textContent.match(/Vocabulario:\s*(\d+)/);
      if (v) scores.vocabulary = { score: Number(v[1]) };
    });
    messages.push({ role: isUser ? 'user' : 'assistant', text: textEl ? textEl.textContent : '', corrections, scores });
  });

  return {
    history: conversationHistory,
    messages,
    scenario: convScenarioSelect ? convScenarioSelect.value : 'free',
    examMode: examModeSelect ? examModeSelect.value : 'off',
    date: new Date().toISOString()
  };
}

function restoreCurrentConversation() {
  try {
    const snapshot = JSON.parse(localStorage.getItem(CONV_CURRENT_KEY) || 'null');
    if (snapshot && snapshot.messages && snapshot.messages.length) {
      restoreConversation(snapshot);
    }
  } catch { /* datos corruptos: empezar de cero */ }
}

// Guardar tras cada mensaje (con debounce)
const _originalAddMessage = addMessage;
addMessage = function (role, text, corrections, scores) {
  _originalAddMessage(role, text, corrections, scores);
  autoSaveCurrentConversation();
};

// ---------- Conversaciones guardadas con nombre ----------
function renderSavedConversations() {
  const list = loadSavedConversations();
  convSavedSelect.innerHTML = '<option value="">— Selecciona una conversación —</option>';
  list.forEach((item, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${item.name} (${item.dateLabel})`;
    convSavedSelect.appendChild(option);
  });
}

convSaveBtn.addEventListener('click', () => {
  if (!conversationHistory.length) {
    showToast('No hay conversación que guardar.', 'warning');
    return;
  }

  const name = prompt('Nombre para esta conversación:', `Conversación ${new Date().toLocaleDateString('es-ES')}`);
  if (!name) return;

  const list = loadSavedConversations();
  list.unshift({
    name,
    snapshot: snapshotCurrentConversation(),
    dateLabel: new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
  });
  localStorage.setItem(CONV_SAVED_KEY, JSON.stringify(list));
  renderSavedConversations();
  showToast('Conversación guardada. Podrás retomarla cuando quieras.', 'success');
});

convLoadBtn.addEventListener('click', () => {
  const index = convSavedSelect.value;
  if (index === '') {
    showToast('Selecciona una conversación de la lista.', 'warning');
    return;
  }
  const item = loadSavedConversations()[Number(index)];
  if (!item) return;

  restoreConversation(item.snapshot);
  showToast(`Conversación "${item.name}" cargada.`, 'info');
});

convDeleteBtn.addEventListener('click', () => {
  const index = convSavedSelect.value;
  if (index === '') {
    showToast('Selecciona una conversación de la lista.', 'warning');
    return;
  }
  const list = loadSavedConversations();
  const item = list[Number(index)];
  if (!item) return;
  if (!confirm(`¿Eliminar la conversación "${item.name}"?`)) return;

  list.splice(Number(index), 1);
  localStorage.setItem(CONV_SAVED_KEY, JSON.stringify(list));
  renderSavedConversations();
  showToast('Conversación eliminada.', 'info');
});

// Restaurar la conversación actual al cargar la página
restoreCurrentConversation();
renderSavedConversations();

