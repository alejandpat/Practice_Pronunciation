// ============================================================
// Evaluador de Pronunciación — js/25-categories.js
// Navegación por 4 categorías: Listening, Speaking, Grammar, Writing.
// - Al activar una categoría: se muestra su picker y se oculta el body.
// - Al elegir una tarjeta: se oculta el picker y se muestra el body.
// - Listening: juego primero → pantalla de video después.
// - Botón "← Cambiar": vuelve al picker.
// - Mapea accesos directos antiguos (practice, dictionary...) a su categoría.
// ============================================================

// Categoría (sin prefijo) a la que pertenece cada actividad
const ACTIVITY_TO_CATEGORY = {
  practice: 'speaking',
  conversation: 'speaking',
  phonemes: 'speaking',
  grammar: 'grammar',
  vocabulary: 'grammar',
  review: 'grammar',
  translate: 'writing',
  dictionary: 'writing',
  listening: 'listening'
};

// Muestra u oculta un elemento por id (sin fallar si no existe)
function setCatVisible(elId, visible) {
  const el = document.getElementById(elId);
  if (el) el.classList.toggle('hidden', !visible);
}

// Oculta todas las actividades anidadas de una categoría
function hideCategoryActivities(catId) {
  document.querySelectorAll('#tab-cat-' + catId + ' > .cat-body > .tab-content').forEach((c) => c.classList.add('hidden'));
}

// Activa una categoría: picker visible, body oculto (reset)
function activateCategory(catId) {
  const picker = document.getElementById('cat-' + catId + '-picker');
  const body = document.getElementById('cat-' + catId + '-body');
  if (picker) picker.classList.remove('hidden');
  if (body) body.classList.add('hidden');
}

// Abre una actividad concreta dentro de su categoría (accesos directos)
function openActivityInCategory(activityName) {
  const catId = ACTIVITY_TO_CATEGORY[activityName];
  if (!catId) return false;
  const target = document.getElementById('tab-' + activityName);
  if (!target) return false;
  const picker = document.getElementById('cat-' + catId + '-picker');
  const body = document.getElementById('cat-' + catId + '-body');
  if (picker) picker.classList.add('hidden');
  if (body) body.classList.remove('hidden');
  document.querySelectorAll('#tab-cat-' + catId + ' .tab-content').forEach((c) => c.classList.add('hidden'));
  target.classList.remove('hidden');
  return true;
}

// Al activar una categoría desde el nav, resetear a picker
document.querySelectorAll('.tab[data-tab^="cat-"]').forEach((btn) => {
  btn.addEventListener('click', () => {
    activateCategory(btn.dataset.tab.replace('cat-', ''));
  });
});

// Tarjetas de los pickers (actividades: Speaking, Grammar, Writing)
document.querySelectorAll('.cat-card[data-activity]').forEach((card) => {
  card.addEventListener('click', () => {
    const catEl = card.closest('.tab-content');
    const catId = catEl ? catEl.id.replace('tab-cat-', '') : null;
    if (!catId) return;
    setCatVisible('cat-' + catId + '-picker', false);
    setCatVisible('cat-' + catId + '-body', true);
    hideCategoryActivities(catId);
    setCatVisible('tab-' + card.dataset.activity, true);
    const sel = document.getElementById('cat-' + catId + '-selected');
    const name = (card.querySelector('b') || {}).textContent || '';
    if (sel) sel.textContent = 'Actividad: ' + name;
  });
});

// Tarjetas de Listening: elegir juego primero, video después
document.querySelectorAll('.cat-card[data-game]').forEach((card) => {
  card.addEventListener('click', () => {
    const catEl = card.closest('.tab-content');
    const catId = catEl ? catEl.id.replace('tab-cat-', '') : null;
    if (!catId) return;
    setCatVisible('cat-' + catId + '-picker', false);
    setCatVisible('cat-' + catId + '-body', true);
    // mostrar la pantalla de video (tab-listening anidado)
    hideCategoryActivities(catId);
    setCatVisible('tab-listening', true);
    // activar el panel del juego elegido (reutiliza la lógica de 24-listening-games.js)
    const gameName = card.dataset.game;
    if (typeof showGamePanel === 'function') {
      showGamePanel(gameName);
      const inits = {
        scramble: initScramble,
        minimal: initMinimal,
        sprint: initSprint,
        karaoke: initKaraoke,
        quiz: initQuiz,
        phoneme: initPhoneme
      };
      if (gameName === 'gaps') {
        // huecos: mostrar la rueda de frases y regenerar el ejercicio
        if (typeof lpWheel !== 'undefined' && lpWheel) lpWheel.classList.remove('hidden');
        if (typeof generateListeningExercise === 'function') generateListeningExercise();
      } else if (gameName === 'dictation') {
        if (typeof buildDictation === 'function') buildDictation();
      } else if (inits[gameName]) {
        inits[gameName]();
      }
    }
    const sel = document.getElementById('cat-' + catId + '-selected');
    const name = (card.querySelector('b') || {}).textContent || '';
    if (sel) sel.textContent = 'Juego: ' + name + ' — ahora busca o carga un video';
  });
});

// Botones "← Cambiar": volver al picker
document.querySelectorAll('.cat-back-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    activateCategory(btn.dataset.back.replace('cat-', ''));
  });
});

// Accesos directos antiguos: data-goto="practice" → abre la actividad en su categoría
const _origActivateTabByName = activateTabByName;
activateTabByName = function (tabName) {
  if (ACTIVITY_TO_CATEGORY[tabName]) {
    const navBtn = document.querySelector('.tab[data-tab="cat-' + ACTIVITY_TO_CATEGORY[tabName] + '"]');
    if (navBtn) navBtn.click();
    openActivityInCategory(tabName);
    return;
  }
  _origActivateTabByName(tabName);
};
