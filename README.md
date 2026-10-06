# 🎤 Evaluador de Pronunciación

Aplicación web local para practicar tu **inglés**: evalúa tu **pronunciación**, **gramática** y **vocabulario** en tiempo real.

## ✨ Características

- **Reconocimiento de voz en tiempo real** (Web Speech API del navegador, gratis).
- **Pronunciación**: comparación palabra por palabra contra el texto objetivo, con puntuación y palabras problemáticas resaltadas.
- **Gramática y vocabulario**: análisis inteligente con **Google Gemini** (correcciones, explicaciones y sugerencias de vocabulario más rico, en español o inglés).
- **💬 Conversación libre**: habla en inglés sobre cualquier tema; la IA responde y corrige tus errores para mantener la conversación. Con **modo oral**: el tutor responde en voz alta (con la voz que elijas en Configuración) y vuelve a escucharte automáticamente para una conversación hablada continua.
- **🌍 Traducción**: traducción bidireccional Inglés ↔ Español con Gemini.
- **📖 Diccionario**: busca cualquier palabra o frase en inglés y obtén definición, traducción, tipo de palabra, ejemplos y palabras relacionadas. Desde ahí puedes escucharla o enviarla a Práctica. Conectado con el popup de palabras de las otras secciones.
- **🎯 Niveles de dificultad**: Principiante (A1-A2), Intermedio (B1-B2) y Avanzado (C1-C2). Ajustan las frases sugeridas, el rigor de la evaluación y el estilo de la conversación.
- **🔊 Escuchar el texto objetivo**: síntesis de voz del navegador (gratis) para oír cómo se pronuncia la frase o párrafo antes de leerlo, con control de velocidad (0.6x a 1.2x) y **selector de voz** en Configuración (las voces "Natural" de Edge suenan muy realistas).
- **🔄 Otras frases**: botón que muestra un set aleatorio de frases y párrafos del nivel activo, para variar la práctica sin cambiar de nivel.
- **📄 Párrafos de práctica**: cada nivel incluye un párrafo completo para practicar lectura; también puedes pegar tu propio texto largo.
- **📴 Respaldo local con Ollama**: si Gemini no está disponible (sin internet o saturado), la app usa automáticamente tu Ollama local (`http://localhost:11434`). También puedes activar **"Usar Ollama directamente"** para saltarte Gemini por completo.
- **📐 Práctica de gramática con IA**: ejercicios de opción múltiple generados según tus deficiencias detectadas en conversaciones, por tema aleatorio del nivel o **eligiendo un tema específico** (pasados, condicionales, voz pasiva…). Con explicación de cada respuesta.
- **🧠 Práctica de vocabulario con IA**: ejercicios con las palabras que más fallas, por tema del nivel o por tema específico (negocios, viajes, phrasal verbs, idioms…).
- **👥 Perfiles de usuario**: cada persona tiene sus propios historiales, progreso, rachas, nivel y conversaciones. Puedes crear, cambiar, renombrar y eliminar perfiles desde Configuración. La clave de API y la voz son compartidas entre perfiles.
- **💾 Respaldo de datos**: exporta todos tus historiales, progreso y conversaciones a un archivo JSON e impórtalos en otro dispositivo o navegador (la clave de API no se incluye).
- **📋 Historial de práctica**: cada sesión (práctica o conversación) se guarda automáticamente con sus puntuaciones; incluye opción de limpiarlo.
- **🔤 Fonemas y pares mínimos**: ejercicios de los sonidos más difíciles para hispanohablantes (th, ship/sheep, b/v, h aspirada, grupos consonánticos, terminación -ed). Escucha los pares mínimos, léelos en voz alta y recibe una puntuación por sonido.
- **🃏 Repaso con repetición espaciada (SRS)**: las palabras que fallas en la práctica se convierten en tarjetas de repaso (estilo Anki) con intervalos crecientes (1, 2, 4, 8, 16, 32 días). Escúchalas, practícalas en frases generadas por IA y márcalas como dominadas.
- **📉 Palabras que más fallas**: top 10 de tus palabras con más fallos, con generación de frases de práctica en contexto vía Gemini.
- **🎧 Shadowing**: la app repite la frase objetivo 3 veces (la primera más lenta) con pausas para que la repitas simultáneamente, técnica de imitación simultánea.
- **✍️ Dictado**: escucha la frase con TTS y escríbela; se compara palabra por palabra con el original para entrenar el listening.
- **⏺ Grabación y comparación de audio**: graba tu voz leyendo el texto y compárala lado a lado con la voz TTS del texto objetivo para autoevaluarte por oído.
- **🤖 Evaluación por audio con IA (opcional)**: envía tu grabación directamente a Gemini (multimodal) para que la transcriba y evalúe tu pronunciación real, con consejos por palabra. Mucho más precisa que la transcripción del navegador; consume ~500 tokens de tu cuota por evaluación.
- **🎵 Análisis de ritmo y entonación**: tras cada lectura, la app analiza tu velocidad de habla, pausas y si la entonación coincide con el tipo de frase (pregunta vs afirmación).
- **🎭 Escenarios de rol en Conversación**: practica situaciones reales — aeropuerto, restaurante, entrevista de trabajo, hotel, médico y compras — con vocabulario clave de cada escenario y el tutor interpretando un personaje.
- **📝 Modo examen**: simulacro tipo Cambridge/IELTS — describe u opina sobre un tema durante 1 minuto con rúbrica de puntuación (fluidez, vocabulario, gramática) o entrevista de trabajo pregunta por pregunta con feedback.
- **🔥 Rachas y metas diarias**: racha de días practicados, meta diaria de 3 sesiones, mejor racha histórica y calendario de los últimos 7 días en Progreso.
- Todo corre localmente en tu PC; solo el texto transcrito se envía a la API de Gemini.

## 🚀 Cómo usarla

1. **Abre la app en Chrome o Edge** (recomendado; Firefox no soporta reconocimiento de voz).
   - Opción A: abre `index.html` directamente (doble clic).
   - Opción B (mejor): sirve la carpeta con un servidor local:
     ```
     npx serve .
     ```
     y abre la URL que indica (ej. `http://localhost:3000`).
2. **Pega tu clave de API de Gemini** en la pestaña **⚙️ Configuración** y pulsa *Guardar*.
   - Consíguela gratis en: https://aistudio.google.com/apikey
   - Se guarda solo en tu navegador (localStorage).
3. **Escribe o elige una frase** para practicar (hay sugerencias rápidas).
4. Pulsa **🎤 Empezar a hablar**, lee la frase en voz alta y pulsa **⏹ Detener**.
5. Verás al instante tu **puntuación de pronunciación** con el detalle palabra por palabra.
6. Pulsa **✨ Evaluar con IA** para el análisis de **gramática** y **vocabulario**.

### 💬 Conversación libre

1. Ve a la pestaña **Conversación**.
2. Pulsa **🎤 Empezar a hablar** y di lo que quieras en inglés.
3. Al detener, la IA te responde (en inglés) y muestra correcciones debajo de tu mensaje.
4. Sigue hablando para mantener la conversación; usa **🗑️ Nueva conversación** para reiniciar.

### 🌍 Traducción

1. Ve a la pestaña **Traducción**.
2. Escribe el texto, elige la dirección (EN→ES o ES→EN) y pulsa **Traducir**.

### 📐 Gramática y 🧠 Vocabulario

1. Ve a la pestaña **Gramática** o **Vocabulario** y elige el modo: **según mis deficiencias**, **tema del nivel (aleatorio)** o **elegir tema específico**.
2. Pulsa **Generar ejercicio** y responde las preguntas de opción múltiple.
3. Al comprobar verás tu puntuación y la explicación de cada respuesta.
4. Tus resultados alimentan los gráficos de **Progreso → Resultados de ejercicios**.

### 📋 Historial

1. Ve a la pestaña **Historial** para ver todas tus sesiones con fecha, modo y puntuaciones.
2. Se guardan hasta 100 sesiones en tu navegador. Usa **Limpiar historial** para borrarlas.
3. **💾 Exportar (JSON)** descarga un respaldo de todo tu historial.
4. Al llegar a **90 sesiones** verás un aviso; al llegar a 100 se elimina la más antigua (con notificación).

### 📈 Progreso

1. Ve a la pestaña **Progreso** para ver la evolución de tus puntuaciones.
2. El gráfico de líneas muestra pronunciación, gramática y vocabulario sesión por sesión.
3. Las tarjetas superiores comparan tu promedio reciente contra tus primeras sesiones (▲ mejoró / ▼ bajó).
4. En **📊 Por habilidad** (subsección colapsable) ves cada habilidad por separado.
5. En **📐 Resultados de ejercicios** tienes dos gráficos colapsables: **🗂️ Por conjunto** (gramática vs vocabulario) y **🏷️ Por temática** (puntuación media por cada tema practicado).

### 👥 Perfiles

1. Ve a **Configuración → Perfiles de usuario**.
2. **Crear**: escribe un nombre y pulsa *Crear perfil* (empieza vacío).
3. **Cambiar**: selecciona en el desplegable y pulsa *Cambiar a este perfil*.
4. **Renombrar**: escribe el nuevo nombre y pulsa *Renombrar perfil activo* (conserva todos los datos).
5. **Eliminar**: borra el perfil activo y todos sus datos (con confirmación).

## 📁 Archivos

| Archivo       | Descripción                                        |
| ------------- | -------------------------------------------------- |
| `index.html`  | Estructura de la interfaz (pestañas: Práctica, Conversación, Traducción, Diccionario, Fonemas, Repaso, Gramática, Vocabulario, Progreso, Historial, Configuración) |
| `styles.css`  | Estilos (tema oscuro)                              |
| `app.js`      | Reconocimiento de voz, evaluación local, API Gemini, SRS, perfiles, historial y gráficos |
| `assets/`     | Icono de la aplicación (favicon)                   |

> **Nota:** los gráficos de progreso usan [Chart.js](https://www.chartjs.org/) cargado desde CDN (requiere internet). El resto de la app funciona sin conexión excepto las llamadas a Gemini.

## ⚠️ Notas

- El navegador pedirá **permiso de micrófono** la primera vez; acéptalo.
- El reconocimiento de voz de Chrome/Edge procesa el audio en servidores del navegador (no en esta app).
- Si usas `file://` y el micrófono no funciona, usa la Opción B (`npx serve .`).
- Modelo principal: `gemini-3.8-flash`; respaldo automático con `gemini-3.5-flash-lite` si el principal está saturado. Puedes cambiarlos en `app.js` (constantes `GEMINI_PRIMARY_MODEL` y `GEMINI_FALLBACK_MODEL`).
- **Ollama como respaldo sin internet**: instala [Ollama](https://ollama.com), descarga un modelo (`ollama pull llama3.2`) y configura URL y modelo en la sección de Configuración de la app. Nota: si abres la app con `file://`, el navegador puede bloquear la conexión a `localhost` por CORS; en ese caso usa `npx serve .` y abre la app desde `http://localhost`. También puede que necesites permitir el origen con la variable de entorno `OLLAMA_ORIGINS=*` al iniciar Ollama.
