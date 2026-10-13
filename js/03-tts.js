// ============================================================
// SÍNTESIS DE VOZ (escuchar la frase/párrafo objetivo)
// ============================================================
const speakBtn = document.getElementById('speak-btn');
const stopSpeakBtn = document.getElementById('stop-speak-btn');
const speechRateSelect = document.getElementById('speech-rate');
const voiceSelect = document.getElementById('voice-select');

// ---------- Selector de voces ----------
function populateVoices() {
  const voices = window.speechSynthesis.getVoices();
  const englishVoices = voices.filter((v) => v.lang.startsWith('en'));

  // Conservar la opción por defecto y la selección guardada
  const savedVoice = localStorage.getItem('speech_voice') || '';
  voiceSelect.innerHTML = '<option value="">Voz del sistema por defecto</option>';

  englishVoices.forEach((voice) => {
    const option = document.createElement('option');
    option.value = voice.name;
    // Etiqueta: nombre + origen (Online = voces naturales de Edge)
    const isNatural = /natural|online/i.test(voice.name);
    option.textContent = (isNatural ? '⭐ ' : '') + voice.name + ' (' + voice.lang + ')';
    voiceSelect.appendChild(option);
  });

  if (savedVoice) voiceSelect.value = savedVoice;
}

voiceSelect.addEventListener('change', () => {
  localStorage.setItem('speech_voice', voiceSelect.value);
});

function getSelectedVoice() {
  const voices = window.speechSynthesis.getVoices();
  const savedVoice = voiceSelect.value;
  if (savedVoice) {
    const found = voices.find((v) => v.name === savedVoice);
    if (found) return found;
  }
  // Respaldo: primera voz en inglés disponible
  return voices.find((v) => v.lang.startsWith('en')) || null;
}

function speakTargetText() {
  const text = targetText.value.trim();
  if (!text) {
    showToast('Escribe o elige una frase primero.', 'warning');
    return;
  }

  window.speechSynthesis.cancel(); // cancelar cualquier lectura previa

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = parseFloat(speechRateSelect.value) || 1;

  // Usar la voz elegida en Configuración (o una voz en inglés por defecto)
  const selectedVoice = getSelectedVoice();
  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
  }

  utterance.onend = () => {
    speakBtn.disabled = false;
    stopSpeakBtn.disabled = true;
  };

  speakBtn.disabled = true;
  stopSpeakBtn.disabled = false;
  window.speechSynthesis.speak(utterance);
}

speakBtn.addEventListener('click', speakTargetText);

stopSpeakBtn.addEventListener('click', () => {
  window.speechSynthesis.cancel();
  speakBtn.disabled = false;
  stopSpeakBtn.disabled = true;
});

// Inicialmente los botones de detener deshabilitados
stopSpeakBtn.disabled = true;

// Precargar voces (algunas plataformas las cargan de forma asíncrona)
if (window.speechSynthesis) {
  populateVoices();
  window.speechSynthesis.onvoiceschanged = populateVoices;
}

// ---------- Probador de voz (Configuración) ----------
const voiceTestBtn = document.getElementById('voice-test-btn');
const voiceTestStopBtn = document.getElementById('voice-test-stop-btn');
const voiceTestText = document.getElementById('voice-test-text');

function speakTestPhrase() {
  const text = voiceTestText.value.trim();
  if (!text) {
    showToast('Escribe una frase para probar la voz.', 'warning');
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = parseFloat(speechRateSelect.value) || 1;

  const selectedVoice = getSelectedVoice();
  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
  } else {
    utterance.lang = 'en-US';
  }

  utterance.onend = () => {
    voiceTestBtn.disabled = false;
    voiceTestStopBtn.disabled = true;
  };

  voiceTestBtn.disabled = true;
  voiceTestStopBtn.disabled = false;
  window.speechSynthesis.speak(utterance);
}

voiceTestBtn.addEventListener('click', speakTestPhrase);

voiceTestStopBtn.addEventListener('click', () => {
  window.speechSynthesis.cancel();
  voiceTestBtn.disabled = false;
  voiceTestStopBtn.disabled = true;
});

voiceTestStopBtn.disabled = true;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

