// ============================================================
// SELECTOR DE IDIOMA DE LA INTERFIZ
// ============================================================

const uiLangSelect = document.getElementById('ui-lang');

if (uiLangSelect) {
  uiLangSelect.value = getUiLanguage();
  uiLangSelect.addEventListener('change', () => {
    localStorage.setItem(UI_LANG_KEY, uiLangSelect.value);
    showToast(getUiLanguage() === 'en' ? 'Switching UI to English' : 'Cambiando la interfaz a Español', 'info');
    setTimeout(() => location.reload(), 800);
  });
}

// Aplicar el idioma al cargar (después de que los módulos hayan renderizado todo)
if (getUiLanguage() === 'en') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyUiLanguage);
  } else {
    applyUiLanguage();
  }
}

