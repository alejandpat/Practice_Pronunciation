// ============================================================
// NAVEGACIÓN DE CONVERSACIÓN LARGA (ir al inicio / último mensaje)
// ============================================================

const convNavButtons = document.getElementById('conv-nav-buttons');
const convTopBtn = document.getElementById('conv-top-btn');
const convBottomBtn = document.getElementById('conv-bottom-btn');

// Mostrar los botones solo cuando la conversación es larga (más de ~2 pantallas)
function updateConvNavButtons() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  convNavButtons.classList.toggle('hidden', scrollable < 600);
}

window.addEventListener('scroll', updateConvNavButtons, { passive: true });
window.addEventListener('resize', updateConvNavButtons);

convTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

convBottomBtn.addEventListener('click', () => {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
});

// Actualizar visibilidad al añadir mensajes
const _navOriginalAddMessage = addMessage;
addMessage = function (role, text, corrections, scores) {
  _navOriginalAddMessage(role, text, corrections, scores);
  updateConvNavButtons();
};

updateConvNavButtons();

