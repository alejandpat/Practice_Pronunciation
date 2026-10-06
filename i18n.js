// ============================================================
// i18n.js — Traducción de la interfaz (Español / English)
// El diccionario mapea el texto español EXACTO (tal como aparece
// en el DOM) a su traducción inglesa. applyUiLanguage() recorre
// el DOM y sustituye textos, placeholders, títulos y opciones.
// ============================================================

const I18N = {
  // ---------- Título y header ----------
  '🎤 Evaluador de Pronunciación': '🎤 Pronunciation Evaluator',
  'Practica tu inglés: pronunciación, gramática y vocabulario en tiempo real': 'Practice your English: pronunciation, grammar and vocabulary in real time',
  'App local · Tu voz se procesa en el navegador y el texto se analiza con Gemini': 'Local app · Your voice is processed in the browser and the text is analyzed with Gemini',
  'Racha y actividad diaria — ver detalles en Progreso': 'Streak and daily activity — see details in Progress',
  'Perfil activo — ir a Configuración': 'Active profile — go to Settings',
  'Evaluador de Pronunciación': 'Pronunciation Evaluator',

  // ---------- Navegación ----------
  '🏠 Inicio': '🏠 Home',
  '🎯 Actividades': '🎯 Activities',
  '📝 Práctica': '📝 Practice',
  '💬 Conversación': '💬 Conversation',
  '🌍 Traducción': '🌍 Translation',
  '📖 Diccionario': '📖 Dictionary',
  '🔤 Fonemas': '🔤 Phonemes',
  '🃏 Repaso': '🃏 Review',
  '📐 Gramática': '📐 Grammar',
  '🧠 Vocabulario': '🧠 Vocabulary',
  '📈 Progreso': '📈 Progress',
  '📋 Historial': '📋 History',
  '⚙️ Configuración': '⚙️ Settings',

  // ---------- Práctica ----------
  '📝 Texto objetivo': '📝 Target text',
  'Escribe o elige una frase para practicar. Luego pulsa el micrófono y léela en voz alta.': 'Type or choose a sentence to practice. Then press the microphone and read it aloud.',
  'Sugerencias:': 'Suggestions:',
  'Ej.: The quick brown fox jumps over the lazy dog. O pega un párrafo completo para practicar lectura.': 'E.g.: The quick brown fox jumps over the lazy dog. Or paste a full paragraph for reading practice.',
  'Velocidad:': 'Speed:',
  '🐢 Lenta (0.6x)': '🐢 Slow (0.6x)',
  'Ligeramente lenta (0.8x)': 'Slightly slow (0.8x)',
  '▶️ Normal (1x)': '▶️ Normal (1x)',
  'Rápida (1.2x)': 'Fast (1.2x)',
  '🔄 Otras frases': '🔄 Other sentences',
  'Mostrar frases diferentes del mismo nivel': 'Show different sentences from the same level',
  '🎤 Empezar a hablar': '🎤 Start speaking',
  '⏹ Detener': '⏹ Stop',
  '🗣️ Lo que escuché': '🗣️ What I heard',
  '🤖 Evaluar pronunciación': '🤖 Evaluate pronunciation',
  '✨ Evaluar con IA': '✨ Evaluate with AI',
  '🔊 Pronunciación': '🔊 Pronunciation',
  '🎧 Shadowing': '🎧 Shadowing',
  '✍️ Dictado': '✍️ Dictation',
  '⏺ Grabar mi voz': '⏺ Record my voice',
  '⏹ Detener grabación': '⏹ Stop recording',
  '🎙️ Tu grabación': '🎙️ Your recording',
  '🤖 Evaluar con audio IA': '🤖 Evaluate with AI audio',
  'Escucha la frase y escríbela. Se comparará con el original.': 'Listen to the sentence and write it. It will be compared with the original.',
  'Escribe lo que escuchaste...': 'Write what you heard...',
  '🔊 Escuchar': '🔊 Listen',
  '🔁 Repetir audio': '🔁 Repeat audio',
  '▶️ Reproducir TTS': '▶️ Play TTS',
  '▶️ Empezar repaso': '▶️ Start review',
  '🎚️ Nivel del micrófono:': 'Mic level:',
  '🎯 Pronunciación de tu intervención': '🎯 Pronunciation of your speech',
  'Evalúa la pronunciación de tu última intervención con IA': 'Evaluate the pronunciation of your last speech with AI',

  // ---------- Conversación ----------
  '💬 Conversación libre': '💬 Free conversation',
  'Habla en inglés sobre cualquier tema. La IA te responderá y te corregirá. Pulsa el micrófono para hablar.': 'Talk in English about any topic. The AI will reply and correct you. Press the microphone to speak.',
  'Modo de conversación:': 'Conversation mode:',
  '💬 Por chat (texto)': '💬 Chat (text)',
  '🗣️ Oral (voz)': '🗣️ Oral (voice)',
  'Escenario de rol:': 'Role scenario:',
  '💬 Libre (sin escenario)': '💬 Free (no scenario)',
  'Modo examen:': 'Exam mode:',
  '⭕ Desactivado': '⭕ Disabled',
  '🖼️ Describe un tema (1 min)': '🖼️ Describe a topic (1 min)',
  '💭 Opina sobre un tema (1 min)': '💭 Give your opinion on a topic (1 min)',
  '🎤 Simulacro de entrevista': '🎤 Mock interview',
  '🎯 Evaluar pronunciación automáticamente al terminar de hablar': '🎯 Automatically evaluate pronunciation when you stop speaking',
  'Conversaciones guardadas:': 'Saved conversations:',
  '— Selecciona una conversación —': '— Select a conversation —',
  '📂 Cargar': '📂 Load',
  '🗑️ Eliminar': '🗑️ Delete',
  '💾 Guardar conversación': '💾 Save conversation',
  '🗑️ Nueva conversación': '🗑️ New conversation',
  'Escribe tu mensaje en inglés…': 'Type your message in English…',
  'Ir al inicio de la conversación': 'Go to the start of the conversation',
  '⬆️ Inicio': '⬆️ Top',
  'Ir al último mensaje': 'Go to the last message',
  '⬇️ Último': '⬇️ Bottom',

  // ---------- Traducción ----------
  '🌍 Traducción': '🌍 Translation',
  'Texto de origen': 'Source text',
  'Escribe o pega el texto a traducir...': 'Type or paste the text to translate...',
  'Inglés → Español': 'English → Spanish',
  'Español → Inglés': 'Spanish → English',
  '🌍 Traducir': '🌍 Translate',
  'La traducción aparecerá aquí...': 'The translation will appear here...',
  '🕘 Historial de traducciones': '🕘 Translation history',
  'Se guarda automáticamente cada traducción. Haz clic en una entrada para reutilizarla.': 'Every translation is saved automatically. Click an entry to reuse it.',

  // ---------- Diccionario ----------
  '📖 Diccionario': '📖 Dictionary',
  'Busca cualquier palabra o frase en inglés: definición, traducción, pronunciación y ejemplos. También puedes escucharla con 🔊.': 'Look up any English word or phrase: definition, translation, pronunciation and examples. You can also listen to it with 🔊.',
  'Escribe una palabra o frase en inglés (ej. achieve, breakthrough...)': 'Type an English word or phrase (e.g. achieve, breakthrough...)',
  '🔍 Buscar': '🔍 Search',
  '🕘 Palabras buscadas': '🕘 Looked-up words',
  'Se guardan automáticamente tus búsquedas. Haz clic en una palabra para buscarla de nuevo.': 'Your searches are saved automatically. Click a word to look it up again.',
  '📚 Definición (en inglés)': '📚 Definition (in English)',
  'Traducción': 'Translation',
  '📚 Tipo': '📚 Type',
  '💬 Ejemplos': '💬 Examples',
  '↔️ Antónimos': '↔️ Antonyms',
  '🔁 Sinónimos': '🔁 Synonyms',
  '🔗 Palabras relacionadas': '🔗 Related words',
  '🎤 Practicar esta palabra': '🎤 Practice this word',
  '🎤 Practicar en Práctica': '🎤 Practice in Practice tab',

  // ---------- Fonemas ----------
  '🔤 Fonemas': '🔤 Phonemes',
  '🔤 Fonemas difíciles para hispanohablantes': '🔤 Difficult phonemes for Spanish speakers',
  'Elige un sonido problemático, escucha los pares mínimos y practícalos en voz alta. La app evalúa si distinguiste bien los sonidos.': 'Choose a problematic sound, listen to the minimal pairs and practice them aloud. The app evaluates whether you distinguished the sounds well.',
  'Sonido a practicar:': 'Sound to practice:',
  '🎲 Otros pares mínimos': '🎲 Other minimal pairs',
  '🎤 Leer los pares en voz alta': '🎤 Read the pairs aloud',
  '🔊 Resultado por sonido': '🔊 Result by sound',
  '🕘 Historial de fonemas': '🕘 Phoneme history',
  'Se guarda automáticamente cada evaluación: sonido practicado, puntuación y palabras falladas.': 'Every evaluation is saved automatically: sound practiced, score and missed words.',

  // ---------- Repaso ----------
  '🃏 Repaso — repetición espaciada': '🃏 Review — spaced repetition',
  'Las palabras que fallas en la práctica se convierten en tarjetas. Repasa las que tocan hoy: escúchalas, practícalas en una frase y márcalas como sabidas.': 'Words you miss in practice become flashcards. Review the ones due today: listen to them, practice them in a sentence and mark them as known.',
  '🗑️ Vaciar mazo': '🗑️ Empty deck',
  '✅ La sé': '✅ I know it',
  '🔁 Repasar pronto': '🔁 Review soon',

  // ---------- Gramática / Vocabulario ----------
  '📐 Gramática': '📐 Grammar',
  '📐 Práctica de gramática': '📐 Grammar practice',
  'Ejercicios generados con IA: según tus deficiencias detectadas en conversaciones o por temas, según tu nivel.': 'AI-generated exercises: based on your weaknesses detected in conversations or by topics, according to your level.',
  'Modo:': 'Mode:',
  '🎯 Según mis deficiencias': '🎯 Based on my weaknesses',
  'La IA analizará tus últimas respuestas con correcciones para crear el ejercicio.': 'The AI will analyze your latest corrected answers to create the exercise.',
  '🎲 Tema del nivel (aleatorio)': '🎲 Level topic (random)',
  '📌 Elegir tema específico': '📌 Choose a specific topic',
  '✨ Generar ejercicio': '✨ Generate exercise',
  '🔄 Otro ejercicio': '🔄 Another exercise',
  '✅ Comprobar': '✅ Check',
  '🧠 Práctica de vocabulario': '🧠 Vocabulary practice',
  'Aprende palabras nuevas generadas con IA: según tus deficiencias (palabras que más fallas) o por temas, según tu nivel.': 'Learn new AI-generated words: based on your weaknesses (most missed words) or by topics, according to your level.',
  'La IA usará las palabras que más fallas en la pronunciación para crear el ejercicio.': 'The AI will use the words you miss most in pronunciation to create the exercise.',

  // ---------- Progreso ----------
  '📈 Mi progreso': '📈 My progress',
  'Evolución de tus puntuaciones en las últimas sesiones de práctica.': 'Evolution of your scores in recent practice sessions.',
  'Filtrar por nivel:': 'Filter by level:',
  'Todos los niveles': 'All levels',
  '📊 Por habilidad': '📊 By skill',
  'Cada habilidad por separado, con la misma información del gráfico general.': 'Each skill separately, with the same information as the general chart.',
  '📐 Resultados de ejercicios': '📐 Exercise results',
  'Puntuaciones de los ejercicios de gramática y vocabulario, con los mismos filtros de nivel.': 'Scores from grammar and vocabulary exercises, with the same level filters.',
  '🗂️ Por conjunto': '🗂️ By set',
  'Evolución de tus puntuaciones: gramática vs vocabulario.': 'Evolution of your scores: grammar vs vocabulary.',
  '🏷️ Por temática': '🏷️ By topic',
  'Media de puntuación por tema practicado. Azul: gramática · Verde: vocabulario.': 'Average score per topic practiced. Blue: grammar · Green: vocabulary.',
  'Aún no hay datos suficientes. Haz al menos una práctica con evaluación para ver tu progreso.': 'Not enough data yet. Do at least one practice session with evaluation to see your progress.',
  '📊 Seguimiento por actividad': '📊 Activity tracking',
  'Sesiones registradas en cada actividad. Cualquier actividad cuenta para mantener la racha.': 'Sessions recorded per activity. Any activity counts to keep the streak.',
  '🔥 Rachas y metas diarias': '🔥 Streaks and daily goals',

  // ---------- Historial ----------
  '📋 Historial': '📋 History',
  '📋 Historial de práctica': '📋 Practice history',
  'Se guarda automáticamente cada vez que evalúas una sesión de práctica o conversación. Límite: 100 sesiones.': 'Saved automatically every time you evaluate a practice or conversation session. Limit: 100 sessions.',
  '🗑️ Limpiar historial': '🗑️ Clear history',
  '💾 Exportar (JSON)': '💾 Export (JSON)',

  // ---------- Configuración ----------
  '⚙️ Configuración': '⚙️ Settings',
  '🔑 Google Gemini': '🔑 Google Gemini',
  'Clave de API:': 'API key:',
  'Pega tu clave de API aquí (AIza...)': 'Paste your API key here (AIza...)',
  'Guardar': 'Save',
  '💾 Guardar ahora': '💾 Save now',
  'La clave se guarda solo en tu navegador (localStorage). Consíguela gratis en': 'The key is stored only in your browser (localStorage). Get it for free at',
  'Google AI Studio': 'Google AI Studio',
  '📊 Uso de Gemini (plan gratuito)': '📊 Gemini usage (free plan)',
  'Contador local: la app registra cada petición que hace. El límite diario del plan gratuito se reinicia a medianoche, hora del Pacífico (PST/PDT).': 'Local counter: the app logs every request it makes. The free plan daily limit resets at midnight, Pacific time (PST/PDT).',
  '🧹 Reiniciar contador': '🧹 Reset counter',
  '⚠️ El contador es aproximado: solo registra las peticiones hechas desde esta app en este navegador. Si usas la clave en otros proyectos, el uso real puede ser mayor. Consulta los límites oficiales en': '⚠️ The counter is approximate: it only logs requests made from this app in this browser. If you use the key in other projects, actual usage may be higher. Check the official limits at',
  '🔊 Voz del texto objetivo': '🔊 Target text voice',
  'Voz para escuchar el texto objetivo (🔊):': 'Voice to listen to the target text (🔊):',
  'Voz del sistema por defecto': 'Default system voice',
  'Probar la voz seleccionada:': 'Test the selected voice:',
  'Escribe una frase para probar...': 'Type a sentence to test...',
  '▶ Probar': '▶ Test',
  'Muestra las voces en inglés instaladas en tu sistema. En Edge, las voces "Natural" (Online) suenan muy realistas. Prueba con 🔊 Escuchar en la pestaña Práctica.': 'Shows the English voices installed on your system. In Edge, the "Natural" (Online) voices sound very realistic. Try 🔊 Listen in the Practice tab.',
  '🌐 Preferencias': '🌐 Preferences',
  'Nivel de dificultad (MCER):': 'Difficulty level (CEFR):',
  '🟢 Principiante': '🟢 Beginner',
  '🟡 Intermedio': '🟡 Intermediate',
  '🔴 Avanzado': '🔴 Advanced',
  '🟢 Principiante — A1 a A2': '🟢 Beginner — A1 to A2',
  '🟡 Intermedio — B1 a B2': '🟡 Intermediate — B1 to B2',
  '🔴 Avanzado — C1 a C2': '🔴 Advanced — C1 to C2',
  'Idioma de las explicaciones (gramática y vocabulario):': 'Language of explanations (grammar and vocabulary):',
  '⚡ Respaldo local con Ollama (opcional, sin internet)': '⚡ Local fallback with Ollama (optional, offline)',
  'Si Gemini no está disponible (sin internet o saturado), se usará tu Ollama local. Instálalo desde': 'If Gemini is unavailable (no internet or overloaded), your local Ollama will be used. Install it from',
  'URL de Ollama:': 'Ollama URL:',
  '🔄 Buscar modelos': '🔄 Find models',
  '— Escribe la URL y pulsa "Buscar modelos" —': '— Enter the URL and press "Find models" —',
  'Modelo (detectado automáticamente):': 'Model (auto-detected):',
  '⚡ Usar Ollama directamente (sin pasar por Gemini)': '⚡ Use Ollama directly (bypassing Gemini)',
  '📊 Uso de Gemini (plan gratuito)': '📊 Gemini usage (free plan)',
  'Contador local: la app registra cada petición que hace. El límite diario del plan gratuito se reinicia a medianoche, hora del Pacífico (PST/PDT). ': 'Local counter: the app logs every request. The free plan daily limit resets at midnight, Pacific time (PST/PDT).',
  '🧹 Reiniciar contador': '🧹 Reset counter',

  // ---------- Perfiles y respaldo ----------
  '👥 Perfiles de usuario': '👥 User profiles',
  'Cada perfil tiene sus propios historiales, progreso, rachas y nivel. La clave de API y los ajustes de voz son compartidos.': 'Each profile has its own histories, progress, streaks and level. The API key and voice settings are shared.',
  '✔️ Cambiar a este perfil': '✔️ Switch to this profile',
  'Nombre del nuevo perfil': 'New profile name',
  '➕ Crear perfil': '➕ Create profile',
  '✏️ Renombrar perfil activo': '✏️ Rename active profile',
  '🗑️ Eliminar perfil activo': '🗑️ Delete active profile',
  '💾 Respaldo de datos': '💾 Data backup',
  'Exporta todos tus historiales, progreso y conversaciones a un archivo JSON, o restaura una copia previa. La clave de API no se incluye.': 'Export all your histories, progress and conversations to a JSON file, or restore a previous copy. The API key is not included.',
  '⬇️ Exportar datos': '⬇️ Export data',
  '📂 Cargar desde archivo': '📂 Load from file',
  '📥 Importar copia': '📥 Import backup',
  '🔄 Sincronización con archivo (File System Access)': '🔄 File sync (File System Access)',
  'Vincula un archivo JSON de tu disco (p. ej. en OneDrive/Drive) y la app guardará automáticamente cada cambio. Compatible con Chrome y Edge de escritorio.': 'Link a JSON file on your disk (e.g. in OneDrive/Drive) and the app will automatically save every change. Works with desktop Chrome and Edge.',
  '🔗 Vincular archivo': '🔗 Link file',
  '✖️ Desvincular': '✖️ Unlink',

  // ---------- Varios ----------
  '🎯 Actividades': '🎯 Activities',
  'Sugerencias:': 'Suggestions:',
  'Velocidad:': 'Speed:',
  '🗣️ Lo que escuché': '🗣️ What I heard',
  'Guardar': 'Save',
  '🔄 Actualizar': '🔄 Refresh',
  '🔄 Otras frases': '🔄 Other sentences',
  '🔄 Actualizar': '🔄 Refresh',
  'Todos los niveles': 'All levels',
  'Sugerencias:': 'Suggestions:',
  'App local · Tu voz se procesa en el navegador y el texto se analiza con Gemini': 'Local app · Your voice is processed in the browser and the text is analyzed with Gemini',

  // ---------- Página de inicio (About) ----------
  '👋 ¡Hola! Bienvenido a tu Evaluador de Pronunciación': '👋 Hi! Welcome to your Pronunciation Evaluator',
  'Tu compañero para practicar inglés a tu ritmo: pronunciación, conversación, gramática y vocabulario — todo en tu navegador.': 'Your companion for practicing English at your own pace: pronunciation, conversation, grammar and vocabulary — all in your browser.',
  '🚀 ¿Cómo empezar?': '🚀 How to get started?',
  'Configura tu clave de API': 'Set up your API key',
  '— Ve a': '— Go to',
  ' y pega tu clave gratuita de Google AI Studio. Tarda 30 segundos.': ' and paste your free Google AI Studio key. It takes 30 seconds.',
  'Elige tu nivel': 'Choose your level',
  '— Principiante, Intermedio o Avanzado. Todo el contenido se adapta a tu nivel.': '— Beginner, Intermediate or Advanced. All content adapts to your level.',
  'Practica': 'Practice',
  '— Elige una actividad y empieza a hablar. La IA te corrige y evalúa tu progreso.': '— Choose an activity and start speaking. The AI corrects you and evaluates your progress.',
  '📝 Ir a Práctica': '📝 Go to Practice',
  '💬 Probar Conversación': '💬 Try Conversation',
  '✨ ¿Qué puedo hacer aquí?': '✨ What can I do here?',
  '🎤 Pronunciación': '🎤 Pronunciation',
  'Lee frases en voz alta y recibe una puntuación al instante, palabra por palabra, con correcciones de la IA.': 'Read sentences aloud and get an instant score, word by word, with AI corrections.',
  'Charla libre por voz o chat con escenarios de rol (entrevista, restaurante, médico…) y modo examen.': 'Free chat by voice or text with role scenarios (interview, restaurant, doctor…) and exam mode.',
  '📐 Gramática y 🧠 Vocabulario': '📐 Grammar and 🧠 Vocabulary',
  'Ejercicios generados por IA según tus deficiencias o por temas concretos, con explicación de cada respuesta.': 'AI-generated exercises based on your weaknesses or specific topics, with an explanation for every answer.',
  '🌍 Traducción y 📖 Diccionario': '🌍 Translation and 📖 Dictionary',
  'Traduce textos y busca palabras con definición, ejemplos, sinónimos y pronunciación.': 'Translate texts and look up words with definitions, examples, synonyms and pronunciation.',
  '🔤 Fonemas y 🃏 Repaso': '🔤 Phonemes and 🃏 Review',
  'Entrena los sonidos más difíciles para hispanohablantes y repasa con tarjetas de repetición espaciada.': 'Train the most difficult sounds for Spanish speakers and review with spaced-repetition flashcards.',
  '📈 Progreso y 👥 Perfiles': '📈 Progress and 👥 Profiles',
  'Gráficos de evolución, rachas diarias, perfiles para toda la familia y respaldo de datos en JSON.': 'Progress charts, daily streaks, profiles for the whole family and JSON data backup.',
  '🔒 Privacidad': '🔒 Privacy',
  'Todo se guarda en': 'Everything is stored in',
  'tu navegador': 'your browser',
  '(localStorage): historiales, progreso y perfiles. Tu voz se procesa en el navegador y el texto se analiza con Gemini. No hay servidores: tus datos nunca salen de tu dispositivo salvo las peticiones a la IA.': '(localStorage): histories, progress and profiles. Your voice is processed in the browser and the text is analyzed with Gemini. There are no servers: your data never leaves your device except for AI requests.'
};

// ---------- Lógica de aplicación ----------
const UI_LANG_KEY = 'ui_lang';

function getUiLanguage() {
  try {
    return localStorage.getItem(UI_LANG_KEY) || 'es';
  } catch {
    return 'es';
  }
}

// Traduce un texto suelto (exacto en el diccionario; si no, lo devuelve igual)
function t(text) {
  if (getUiLanguage() !== 'en') return text;
  return I18N[text] || text;
}

// Recorre el DOM y aplica la traducción a textos, placeholders, títulos y opciones
function applyUiLanguage() {
  if (getUiLanguage() !== 'en') return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes2 = [];
  while (walker.nextNode()) nodes2.push(walker.currentNode);

  nodes2.forEach((node) => {
    const raw = node.nodeValue;
    const trimmed = raw.replace(/\s+/g, ' ').trim();
    if (!trimmed) return;
    const translated = I18N[trimmed];
    if (translated && translated !== trimmed) {
      // Conservar espacios originales alrededor
      const lead = raw.match(/^\s*/)[0];
      const trail = raw.match(/\s*$/)[0];
      node.nodeValue = lead + translated + trail;
    }
  });

  // Placeholder, title y aria-label
  document.querySelectorAll('[placeholder], [title], [aria-label]').forEach((el) => {
    ['placeholder', 'title', 'aria-label'].forEach((attr) => {
      const val = el.getAttribute(attr);
      if (!val) return;
      const translated = I18N[val.trim()];
      if (translated) el.setAttribute(attr, translated);
    });
  });

  // Opciones de selects
  document.querySelectorAll('select option').forEach((option) => {
    const trimmed = (option.textContent || '').replace(/\s+/g, ' ').trim();
    const translated = I18N[trimmed];
    if (translated) option.textContent = option.textContent.replace(trimmed, translated);
  });
}
