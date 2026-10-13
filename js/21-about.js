// ============================================================
// PÁGINA DE INICIO (ABOUT) — botones de navegación
// ============================================================

document.querySelectorAll('[data-goto]').forEach((btn) => {
  btn.addEventListener('click', () => activateTabByName(btn.dataset.goto));
});
