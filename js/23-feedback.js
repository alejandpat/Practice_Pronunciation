// ============================================================
// Evaluador de Pronunciación — js/23-feedback.js
// Página de contacto: generador de reportes + GitHub Issues
// ============================================================

// ---------- Referencias DOM ----------
const feedbackType = document.getElementById('feedback-type');
const feedbackTitle = document.getElementById('feedback-title');
const feedbackBody = document.getElementById('feedback-body');
const feedbackGenerateBtn = document.getElementById('feedback-generate-btn');
const feedbackCopyBtn = document.getElementById('feedback-copy-btn');
const feedbackGithubLink = document.getElementById('feedback-github-link');
const feedbackStatus = document.getElementById('feedback-status');
const feedbackPreview = document.getElementById('feedback-preview');

// ---------- Diagnóstico del navegador ----------
// Recoge información útil para reproducir y depurar issues.
function collectBrowserDiagnostics() {
  const nav = navigator;
  const speechSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const fsSyncSupported = typeof window.showDirectoryPicker === 'function';
  return [
    `- App version: 1.0 (modular)`,
    `- User agent: ${nav.userAgent}`,
    `- Language: ${nav.language}`,
    `- Screen: ${screen.width}x${screen.height} (viewport ${window.innerWidth}x${window.innerHeight})`,
    `- Speech recognition: ${speechSupported ? 'supported' : 'NOT supported'}`,
    `- File System Access API: ${fsSyncSupported ? 'yes' : 'no'}`,
    `- Local time: ${new Date().toString()}`
  ].join('\n');
}

// ---------- Generación del reporte ----------
function generateFeedbackReport() {
  const type = feedbackType.value;
  const title = feedbackTitle.value.trim() || '(sin título)';
  const description = feedbackBody.value.trim() || '(sin descripción)';

  const labels = { bug: 'bug', feature: 'enhancement', question: 'question' };
  const typeLabels = { bug: 'Bug report', feature: 'Feature request', question: 'Question' };

  const report = `**Tipo:** ${typeLabels[feedbackType.value] || feedbackType.value}
**Título:** ${title}

## Descripción

${description}

## Diagnóstico del entorno

${collectBrowserDiagnostics()}

_Generado desde la página de Contacto de la app._`;

  feedbackPreview.textContent = report;
  feedbackPreview.classList.remove('hidden');
  feedbackGithubLink.href = `https://github.com/`;
  feedbackGithubLink.style.display = '';
  setFeedbackStatus('✅ Reporte generado. Cópialo y pégalo en GitHub Issues o envíalo donde prefieras.', 'success');
}

function setFeedbackStatus(message, type = '') {
  feedbackStatus.textContent = message;
  feedbackStatus.className = 'status ' + type;
}

// ---------- Copiar al portapapeles ----------
async function copyFeedbackReport() {
  if (!feedbackPreview.textContent) {
    setFeedbackStatus('Genera primero el reporte con el botón "Generar reporte".', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(feedbackPreview.textContent);
    setFeedbackStatus('📋 Reporte copiado al portapapeles.', 'success');
  } catch (error) {
    // Fallback para navegadores sin Clipboard API
    const range = document.createRange();
    range.selectNodeContents(feedbackPreview);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    setFeedbackStatus('Selecciona el texto y cópialo con Ctrl+C.', 'info');
  }
  setTimeout(() => setFeedbackStatus(''), 4000);
}

// ---------- Cableado ----------
feedbackGenerateBtn.addEventListener('click', generateFeedbackReport);
feedbackCopyBtn.addEventListener('click', copyFeedbackReport);
