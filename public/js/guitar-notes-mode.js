const GuitarNotesMode = (function () {
  const STORAGE_STATS_KEY = "guitarNotesStats";
  const STORAGE_DIFFICULTY_KEY = "guitarNotesDifficulty";

  const AUTO_NEXT_DELAY_CORRECT_MS = 1400;
  const AUTO_NEXT_DELAY_INCORRECT_MS = 2600;

  // Cromática ascendente en sostenidos: la afinación estándar y cada traste
  // se calculan a partir de aquí (traste = semitonos por encima de la cuerda al aire).
  const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  // Afinación estándar. Orientación de tablatura: la cuerda 1 (Mi agudo, la más fina) arriba,
  // la 6 (Mi grave, la más gruesa) abajo.
  const STRING_OPEN_NOTES = { 1: "E", 2: "B", 3: "G", 4: "D", 5: "A", 6: "E" };
  const STRING_ORDER_TOP_TO_BOTTOM = [1, 2, 3, 4, 5, 6];

  // Trastes con inlay en una guitarra estándar: punto simple en 3,5,7,9,15,17,19,21;
  // doble punto en 12 y 24 (marca la octava).
  const SINGLE_MARKER_FRETS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
  const DOUBLE_MARKER_FRETS = new Set([12, 24]);

  const els = {
    difficultyRow: document.querySelector("#guitarNotesDifficultyRow"),
    exercises: document.querySelector("#gnExercises"),
    accuracy: document.querySelector("#gnAccuracy"),
    streak: document.querySelector("#gnStreak"),
    bestStreak: document.querySelector("#gnBestStreak"),
    avgTime: document.querySelector("#gnAvgTime"),
    totalTime: document.querySelector("#gnTotalTime"),
    error: document.querySelector("#guitarNotesError"),
    content: document.querySelector("#guitarNotesContent"),
    questionCount: document.querySelector("#gnQuestionCount"),
    timer: document.querySelector("#gnTimer"),
    promptText: document.querySelector("#gnPromptText"),
    promptHelp: document.querySelector("#gnPromptHelp"),
    fretboardInner: document.querySelector("#fretboardInner"),
    feedback: document.querySelector("#gnFeedback"),
    nextBtn: document.querySelector("#gnNextBtn"),
    progress: document.querySelector("#gnProgressBar div"),
    roundResult: document.querySelector("#gnRoundResult"),
    roundMessage: document.querySelector("#gnRoundMessage"),
    roundScore: document.querySelector("#gnRoundScore"),
    roundTime: document.querySelector("#gnRoundTime"),
    roundAvgTime: document.querySelector("#gnRoundAvgTime"),
    newRoundBtn: document.querySelector("#gnNewRoundBtn"),
    backBtn: document.querySelector("#guitarNotesBackBtn"),
    historyText: document.querySelector("#guitarNotesHistoryText"),
    gameCard: document.querySelector("#guitarNotesGameCard")
  };

  const state = {
    config: null,
    gnConfig: null,
    difficulty: 2,
    current: null,
    answered: false,
    timerStart: null,
    timerInterval: null,
    secondsLeft: 0,
    roundQuestionNumber: 0,
    roundCorrect: 0,
    roundStartTime: null,
    autoNextTimerId: null,
    stats: loadStats()
  };

  function loadStats() {
    const defaults = {
      exercises: 0,
      correct: 0,
      incorrect: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalTimeMs: 0,
      byNote: {}
    };
    try {
      const raw = localStorage.getItem(STORAGE_STATS_KEY);
      if (raw) return Object.assign(defaults, JSON.parse(raw));
    } catch (error) {
      console.warn("No se pudieron leer las estadísticas de notas de guitarra.", error);
    }
    return defaults;
  }

  function saveStats() {
    localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(state.stats));
  }

  function loadDifficulty(defaultDifficulty) {
    const stored = Number(localStorage.getItem(STORAGE_DIFFICULTY_KEY));
    return stored >= 1 && stored <= 3 ? stored : defaultDifficulty;
  }

  function formatSeconds(ms) {
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function formatDuration(ms) {
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function scrollToTop() {
    if (els.gameCard) {
      els.gameCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function getNoteAtFret(stringNum, fret) {
    const openIndex = CHROMATIC.indexOf(STRING_OPEN_NOTES[stringNum]);
    return CHROMATIC[(openIndex + fret) % 12];
  }

  function normalizeConfig(rawConfig) {
    const gn = rawConfig.guitarNotes || {};

    const enabledStrings =
      Array.isArray(gn.enabledStrings) && gn.enabledStrings.length
        ? gn.enabledStrings.filter((s) => s >= 1 && s <= 6)
        : [1, 2, 3, 4, 5, 6];

    const enabledNotes =
      Array.isArray(gn.enabledNotes) && gn.enabledNotes.length
        ? gn.enabledNotes.map((n) => MusicTheory.normalizeNoteName(n))
        : CHROMATIC.slice();

    return {
      enabledStrings: enabledStrings.length ? enabledStrings : [1, 2, 3, 4, 5, 6],
      enabledNotes,
      difficulty: gn.difficulty >= 1 && gn.difficulty <= 3 ? gn.difficulty : 2,
      fretsCount: gn.fretsCount > 0 ? gn.fretsCount : 12,
      questionsPerRound: gn.questionsPerRound > 0 ? gn.questionsPerRound : 15,
      timePerQuestionSeconds: gn.timePerQuestionSeconds > 0 ? gn.timePerQuestionSeconds : 0
    };
  }

  function noteInEnabledSet(note, enabledNotes) {
    const normalized = MusicTheory.normalizeNoteName(note);
    return enabledNotes.some(
      (n) => n === normalized || MusicTheory.isEnharmonicMatch(n, normalized)
    );
  }

  function notesMatch(a, b) {
    const na = MusicTheory.normalizeNoteName(a);
    const nb = MusicTheory.normalizeNoteName(b);
    if (na === nb) return true;
    if (!state.config.allowEnharmonicAnswers) return false;
    return MusicTheory.isEnharmonicMatch(na, nb);
  }

  // --- Diapasón (diagrama: cuerda 1/fina arriba, cuerda 6/gruesa abajo, como una tablatura) ---

  function renderFretboard() {
    const gn = state.gnConfig;
    const enabledSet = new Set(gn.enabledStrings);
    const gridCols = `40px repeat(${gn.fretsCount + 1}, minmax(34px, 1fr))`;

    els.fretboardInner.innerHTML = "";

    // Fila de marcadores (los puntos de referencia del diapasón real: 3,5,7,9,15,17,19,21
    // simples, 12 y 24 dobles), arriba de todo, igual que en un diagrama de tablatura.
    const markerRow = document.createElement("div");
    markerRow.className = "fret-row marker-row";
    markerRow.style.gridTemplateColumns = gridCols;
    markerRow.appendChild(document.createElement("div")).className = "string-label";
    for (let f = 0; f <= gn.fretsCount; f++) {
      const cell = document.createElement("div");
      cell.className = "marker-cell";
      if (DOUBLE_MARKER_FRETS.has(f)) {
        cell.classList.add("marker-double");
        cell.append(document.createElement("span"), document.createElement("span"));
      } else if (SINGLE_MARKER_FRETS.has(f)) {
        cell.classList.add("marker-single");
        cell.appendChild(document.createElement("span"));
      }
      markerRow.appendChild(cell);
    }
    els.fretboardInner.appendChild(markerRow);

    // Filas de cuerdas: cada celda es el espacio clicable de "ese traste" en esa cuerda
    // (el traste 0 es la cuerda al aire, antes de la cejuela).
    STRING_ORDER_TOP_TO_BOTTOM.forEach((stringNum) => {
      const row = document.createElement("div");
      row.className = "fret-row";
      row.style.gridTemplateColumns = gridCols;
      if (!enabledSet.has(stringNum)) row.classList.add("string-disabled");

      const label = document.createElement("div");
      label.className = "string-label";
      label.textContent = STRING_OPEN_NOTES[stringNum];
      row.appendChild(label);

      for (let f = 0; f <= gn.fretsCount; f++) {
        const note = getNoteAtFret(stringNum, f);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "fret-cell";
        if (f === 0) btn.classList.add("open-string");
        btn.dataset.string = String(stringNum);
        btn.dataset.fret = String(f);
        btn.dataset.note = note;
        btn.setAttribute("aria-label", `Cuerda ${stringNum}, traste ${f}`);

        if (!enabledSet.has(stringNum)) {
          btn.disabled = true;
        } else {
          btn.addEventListener("click", () => onFretClick(stringNum, f));
        }

        row.appendChild(btn);
      }
      els.fretboardInner.appendChild(row);
    });

    // Fila de números de traste, abajo de todo.
    const numberRow = document.createElement("div");
    numberRow.className = "fret-row number-row";
    numberRow.style.gridTemplateColumns = gridCols;
    numberRow.appendChild(document.createElement("div")).className = "string-label";
    for (let f = 0; f <= gn.fretsCount; f++) {
      const cell = document.createElement("div");
      cell.className = "fret-number";
      cell.textContent = String(f);
      numberRow.appendChild(cell);
    }
    els.fretboardInner.appendChild(numberRow);
  }

  function clearFretHighlights() {
    els.fretboardInner.querySelectorAll(".fret-cell").forEach((btn) => {
      btn.classList.remove("fret-correct", "fret-clicked-correct", "fret-clicked-wrong");
    });
  }

  function setFretboardEnabled(enabled) {
    const enabledSet = new Set(state.gnConfig.enabledStrings);
    els.fretboardInner.querySelectorAll(".fret-cell").forEach((btn) => {
      btn.disabled = enabled ? !enabledSet.has(Number(btn.dataset.string)) : true;
    });
  }

  // --- Preguntas ---

  function generateQuestion() {
    const gn = state.gnConfig;
    const requiresString = gn.difficulty >= 2;
    // En nivel avanzado se permite todo el diapasón (una misma nota puede repetirse
    // en la misma cuerda una octava después), en niveles 1-2 se limita a una vuelta
    // cromática completa para que cada nota aparezca una sola vez por cuerda.
    const maxFret = gn.difficulty >= 3 ? gn.fretsCount : Math.min(11, gn.fretsCount);

    const candidates = [];
    gn.enabledStrings.forEach((s) => {
      for (let f = 0; f <= maxFret; f++) {
        const note = getNoteAtFret(s, f);
        if (noteInEnabledSet(note, gn.enabledNotes)) {
          candidates.push({ string: s, fret: f, note });
        }
      }
    });

    if (!candidates.length) return null;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    return { note: pick.note, string: pick.string, fret: pick.fret, requiresString };
  }

  function renderQuestion() {
    clearFretHighlights();
    els.feedback.className = "feedback hidden";
    els.feedback.textContent = "";
    els.nextBtn.classList.add("hidden");
    clearTimeout(state.autoNextTimerId);

    const question = generateQuestion();
    if (!question) {
      els.error.textContent =
        "No hay notas o cuerdas válidas habilitadas en config/game-config.json para Notas Guitarra.";
      els.error.classList.remove("hidden");
      els.content.classList.add("hidden");
      return;
    }

    els.error.classList.add("hidden");
    els.content.classList.remove("hidden");

    state.current = question;
    state.answered = false;
    state.roundQuestionNumber += 1;

    const total = state.gnConfig.questionsPerRound;
    els.questionCount.textContent = `${state.roundQuestionNumber}/${total}`;
    els.progress.style.width = `${((state.roundQuestionNumber - 1) / total) * 100}%`;

    if (question.requiresString) {
      els.promptText.textContent = `(${question.string}) ${question.note}`;
      els.promptHelp.textContent =
        `Presiona la nota ${question.note} en la ${question.string}ª cuerda (${STRING_OPEN_NOTES[question.string]}).`;
    } else {
      els.promptText.textContent = question.note;
      els.promptHelp.textContent = `Presiona la nota ${question.note} en cualquier cuerda habilitada.`;
    }

    setFretboardEnabled(true);
    startTimer();
  }

  function onFretClick(stringNum, fret) {
    if (state.answered) return;
    resolveAnswer({ clickedString: stringNum, clickedFret: fret, clickedNote: getNoteAtFret(stringNum, fret) });
  }

  function onTimeout() {
    resolveAnswer({ timedOut: true });
  }

  function resolveAnswer({ clickedString = null, clickedFret = null, clickedNote = null, timedOut = false }) {
    if (state.answered) return;
    state.answered = true;
    stopTimer();
    setFretboardEnabled(false);

    const elapsedMs = Date.now() - state.timerStart;
    const q = state.current;

    let correct = false;
    if (!timedOut) {
      const noteOk = notesMatch(clickedNote, q.note);
      const stringOk = !q.requiresString || clickedString === q.string;
      correct = noteOk && stringOk;
    }

    if (clickedString !== null) {
      const btn = els.fretboardInner.querySelector(
        `.fret-cell[data-string="${clickedString}"][data-fret="${clickedFret}"]`
      );
      if (btn) btn.classList.add(correct ? "fret-clicked-correct" : "fret-clicked-wrong");
    }

    if (!correct) {
      els.fretboardInner.querySelectorAll(".fret-cell").forEach((btn) => {
        const s = Number(btn.dataset.string);
        const matchesNote = notesMatch(btn.dataset.note, q.note);
        const matchesString = !q.requiresString || s === q.string;
        if (matchesNote && matchesString) btn.classList.add("fret-correct");
      });
    }

    state.stats.exercises += 1;
    state.stats.totalTimeMs += elapsedMs;
    state.stats.byNote[q.note] = state.stats.byNote[q.note] || { correct: 0, total: 0 };
    state.stats.byNote[q.note].total += 1;

    if (correct) {
      state.stats.correct += 1;
      state.stats.byNote[q.note].correct += 1;
      state.stats.currentStreak += 1;
      state.stats.bestStreak = Math.max(state.stats.bestStreak, state.stats.currentStreak);
      state.roundCorrect += 1;
    } else {
      state.stats.incorrect += 1;
      state.stats.currentStreak = 0;
    }

    saveStats();
    updateStatsUI();

    const targetLabel = q.requiresString ? `(${q.string}) ${q.note}` : q.note;
    els.feedback.className = `feedback ${correct ? "correct" : "incorrect"}`;
    els.feedback.textContent = timedOut
      ? `Se acabó el tiempo. La nota era ${targetLabel}.`
      : correct
        ? `¡Correcto! ${targetLabel}.`
        : `Casi. La nota correcta es ${targetLabel}.`;

    els.timer.textContent = formatSeconds(elapsedMs);
    els.nextBtn.classList.remove("hidden");
    els.nextBtn.focus();

    clearTimeout(state.autoNextTimerId);
    state.autoNextTimerId = setTimeout(
      nextQuestion,
      correct ? AUTO_NEXT_DELAY_CORRECT_MS : AUTO_NEXT_DELAY_INCORRECT_MS
    );
  }

  function nextQuestion() {
    clearTimeout(state.autoNextTimerId);
    if (state.roundQuestionNumber >= state.gnConfig.questionsPerRound) {
      finishRound();
      return;
    }
    renderQuestion();
  }

  function finishRound() {
    stopTimer();
    clearTimeout(state.autoNextTimerId);
    els.progress.style.width = "100%";
    els.content.classList.add("hidden");
    els.roundResult.classList.remove("hidden");

    const elapsedMs = Date.now() - state.roundStartTime;
    const total = state.gnConfig.questionsPerRound;
    const ratio = state.roundCorrect / total;

    els.roundScore.textContent = `${state.roundCorrect}/${total}`;
    els.roundTime.textContent = formatDuration(elapsedMs);
    els.roundAvgTime.textContent = formatSeconds(elapsedMs / total);
    els.roundMessage.textContent =
      ratio >= 0.85
        ? "Excelente. Conoces bien el diapasón."
        : ratio >= 0.6
          ? "Buen progreso. Sigue reforzando las cuerdas menos familiares."
          : "Buen comienzo. La práctica diaria hará que ubiques las notas de memoria.";

    scrollToTop();
  }

  function startRound() {
    clearTimeout(state.autoNextTimerId);
    state.roundQuestionNumber = 0;
    state.roundCorrect = 0;
    state.roundStartTime = Date.now();
    els.roundResult.classList.add("hidden");
    els.content.classList.remove("hidden");
    renderQuestion();
    scrollToTop();
  }

  // --- Temporizador ---

  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function startTimer() {
    stopTimer();
    state.timerStart = Date.now();
    const limit = state.gnConfig.timePerQuestionSeconds;

    if (limit > 0) {
      state.secondsLeft = limit;
      els.timer.textContent = `${state.secondsLeft}s`;
      state.timerInterval = setInterval(() => {
        state.secondsLeft -= 1;
        els.timer.textContent = `${Math.max(state.secondsLeft, 0)}s`;
        if (state.secondsLeft <= 0) {
          stopTimer();
          onTimeout();
        }
      }, 1000);
    } else {
      els.timer.textContent = formatSeconds(0);
      state.timerInterval = setInterval(() => {
        els.timer.textContent = formatSeconds(Date.now() - state.timerStart);
      }, 100);
    }
  }

  // --- Estadísticas y dificultad ---

  function setDifficulty(level) {
    state.difficulty = level;
    if (state.gnConfig) state.gnConfig.difficulty = level;
    localStorage.setItem(STORAGE_DIFFICULTY_KEY, String(level));
    els.difficultyRow.querySelectorAll(".difficulty-btn").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.difficulty) === level);
    });
  }

  function updateStatsUI() {
    const accuracy = state.stats.exercises
      ? Math.round((state.stats.correct / state.stats.exercises) * 100)
      : 0;
    const avgTimeMs = state.stats.exercises ? state.stats.totalTimeMs / state.stats.exercises : 0;

    els.exercises.textContent = state.stats.exercises;
    els.accuracy.textContent = `${accuracy}%`;
    els.streak.textContent = state.stats.currentStreak;
    els.bestStreak.textContent = state.stats.bestStreak;
    els.avgTime.textContent = formatSeconds(avgTimeMs);
    els.totalTime.textContent = formatDuration(state.stats.totalTimeMs);

    renderNoteHistory();
  }

  function renderNoteHistory() {
    const entries = Object.entries(state.stats.byNote).filter(([, v]) => v.total > 0);
    if (!entries.length) {
      els.historyText.textContent = "Aún no hay datos suficientes.";
      return;
    }

    els.historyText.textContent = entries
      .sort((a, b) => CHROMATIC.indexOf(a[0]) - CHROMATIC.indexOf(b[0]))
      .map(([note, v]) => `${note}: ${Math.round((v.correct / v.total) * 100)}%`)
      .join("  ·  ");
  }

  function handleGlobalEnter(event) {
    if (event.key !== "Enter") return;
    if (document.querySelector("#guitarNotesView").classList.contains("hidden")) return;
    if (!els.roundResult.classList.contains("hidden")) {
      event.preventDefault();
      startRound();
      return;
    }
    if (!state.answered) return;
    event.preventDefault();
    nextQuestion();
  }

  function teardown() {
    stopTimer();
    clearTimeout(state.autoNextTimerId);
  }

  async function start() {
    try {
      const response = await fetch("/api/game-data");
      if (!response.ok) throw new Error("No fue posible cargar los datos.");
      const data = await response.json();

      state.config = data.config;
      state.gnConfig = normalizeConfig(data.config);
      state.difficulty = loadDifficulty(state.gnConfig.difficulty);
      state.gnConfig.difficulty = state.difficulty;
      setDifficulty(state.difficulty);

      renderFretboard();
      updateStatsUI();
      startRound();
    } catch (error) {
      console.error(error);
      els.error.textContent = error.message;
      els.error.classList.remove("hidden");
      els.content.classList.add("hidden");
    }
  }

  els.nextBtn.addEventListener("click", nextQuestion);
  els.newRoundBtn.addEventListener("click", startRound);

  els.difficultyRow.querySelectorAll(".difficulty-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setDifficulty(Number(btn.dataset.difficulty));
      startRound();
    });
  });

  document.addEventListener("keydown", handleGlobalEnter);

  els.backBtn.addEventListener("click", () => {
    teardown();
    document.dispatchEvent(new CustomEvent("app:back-to-menu"));
  });

  return { start, teardown };
})();
