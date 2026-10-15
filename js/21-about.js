// ============================================================
// PÁGINA DE INICIO (ABOUT) — botones de navegación
// ============================================================

document.querySelectorAll('[data-goto]').forEach((btn) => {
  btn.addEventListener('click', () => activateTabByName(btn.dataset.goto));
});

// ============================================================
// CONFIGURACIÓN — acordeón exclusivo: solo una sección expandida
// ============================================================
const settingsSections = document.querySelectorAll('.settings-section');
settingsSections.forEach((section) => {
  section.addEventListener('toggle', () => {
    // Al abrir una sección, colapsa las demás
    if (section.open) {
      settingsSections.forEach((other) => {
        if (other !== section) other.open = false;
      });
    }
  });
});
// Abre la primera sección por defecto
if (settingsSections.length > 0) settingsSections[0].open = true;

// Subsecciones anidadas (p. ej. Preferencias): también exclusivas entre sí
const settingsSubsections = document.querySelectorAll('.settings-subsection');
settingsSubsections.forEach((section) => {
  section.addEventListener('toggle', () => {
    if (section.open) {
      settingsSubsections.forEach((other) => {
        if (other !== section) other.open = false;
      });
    }
  });
});
