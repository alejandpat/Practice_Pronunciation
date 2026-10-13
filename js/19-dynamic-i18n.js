// ============================================================
// TRADUCCIÓN DE MENSAJES DINÁMICOS (i18n)
// Envuelve las funciones de estado para traducir los mensajes
// generados en tiempo de ejecución con el diccionario de i18n.js
// ============================================================

// Patrones para mensajes con variables (regex ES → EN)
const I18N_PATTERNS = [
  [/^Puntuación: (\d+)\/(\d+) \((\d+)%\)$/, 'Score: $1/$2 ($3%)'],
  [/^Puntuación: (\d+)\/(\d+)$/, 'Score: $1/$2'],
  [/^Puntuación: (\d+)%$/, 'Score: $1%'],
  [/^✅ ¡Excelente! Puntuación: (\d+)%/, '✅ Excellent! Score: $1%'],
  [/^Perfil cambiado a "(.+)"\. Recargando…$/, 'Profile switched to "$1". Reloading…'],
  [/^Perfil "(.+)" creado\.$/, 'Profile "$1" created.'],
  [/^Ya existe un perfil llamado "(.+)"\. Elige otro nombre\.$/, 'A profile named "$1" already exists. Choose another name.'],
  [/^¿Renombrar el perfil "(.+)" a "(.+)"\? Se conservan todos sus datos\.$/, 'Rename profile "$1" to "$2"? All data is kept.'],
  [/^¿Eliminar el perfil "(.+)" y TODOS sus datos \(historiales, progreso, rachas\)\? Esta acción no se puede deshacer\.$/, 'Delete profile "$1" and ALL its data (histories, progress, streaks)? This cannot be undone.'],
  [/^Perfil renombrado a "(.+)"\. Recargando…$/, 'Profile renamed to "$1". Reloading…'],
  [/^No se detectó voz\. Inténtalo de nuevo\.$/, 'No speech detected. Try again.'],
  [/^Escuchando…$/, 'Listening…'],
  [/^🎤 Escuchando…/, '🎤 Listening…'],
  [/^Copiado: /, 'Copied: '],
  [/^Guardado: /, 'Saved: '],
  [/^Conversación restaura/, 'Conversation restored.'],
  [/^Ejercicio de (.+) generado\.$/, 'Exercise on $1 generated.'],
  [/^✅ Perfil "(.+)" creado\./, '✅ Profile "$1" created.']
];

// Traduce un mensaje dinámico: primero exacto, luego por patrones
function tMsg(message) {
  if (getUiLanguage() !== 'en' || typeof message !== 'string') return message;
  if (I18N[message]) return I18N[message];
  for (const [re, replacement] of I18N_PATTERNS) {
    if (re.test(message)) return message.replace(re, replacement);
  }
  return message;
}

// Envolver las funciones de estado para traducir antes de mostrar
(function wrapStatusFunctions() {
  const names = ['setStatus', 'setConvStatus', 'setPhonemeStatus', 'setGrammarStatus', 'setVocabularyStatus', 'showToast'];
  names.forEach((name) => {
    const original = window[name];
    if (typeof original !== 'function') return;
    window[name] = function (message, type, duration) {
      return original.call(this, tMsg(message), type, duration);
    };
  });
})();

