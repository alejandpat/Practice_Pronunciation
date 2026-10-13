// ============================================================
// INICIALIZACIÓN DE HISTORIALES (traducciones y diccionario)
// ============================================================

renderTranslateHistory();
renderDictHistory();
renderActivityTracking();

// Reflejar la pestaña activa en el desplegable de navegación
updateDropdownSummaries();

// Inicializar el dock de conversación según el modo guardado
updateConvDockForMode();

// Persistencia de la auto-evaluación de pronunciación en conversación
if (localStorage.getItem('conv_auto_eval') !== null) convAutoEval.checked = localStorage.getItem('conv_auto_eval') === '1';
convAutoEval.addEventListener('change', () => localStorage.setItem('conv_auto_eval', convAutoEval.checked ? '1' : '0'));

