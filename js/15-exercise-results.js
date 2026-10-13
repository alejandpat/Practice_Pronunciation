// ============================================================
// RESULTADOS DE EJERCICIOS (gramática y vocabulario) — datos
// ============================================================

const EXERCISE_RESULTS_KEY = 'exercise_results';

function loadExerciseResults() {
  try {
    const raw = localStorage.getItem(EXERCISE_RESULTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function addExerciseResult(entry) {
  const list = loadExerciseResults();
  list.unshift({ ...entry, date: new Date().toISOString() });
  localStorage.setItem(EXERCISE_RESULTS_KEY, JSON.stringify(list.slice(0, 200)));
}

// ============================================================
// RESPALDO DE DATOS (exportar / importar JSON)
