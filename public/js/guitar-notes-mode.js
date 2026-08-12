const GuitarNotesMode = (function () {
  const STORAGE_STATS_KEY = "guitarNotesStats";
  const STORAGE_DIFFICULTY_KEY = "guitarNotesDifficulty";
  const STORAGE_SOUND_KEY = "guitarNotesSound";

  const AUTO_NEXT_DELAY_CORRECT_MS = 1400;
  const AUTO_NEXT_DELAY_INCORRECT_MS = 2600;

  // Cromática ascendente en sostenidos: la afinación estándar y cada traste
  // se calculan a partir de aquí (traste = semitonos por encima de la cuerda al aire).
  const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  // Afinación estándar. Orientación de tablatura: la cuerda 1 (Mi agudo, la más fina) arriba,
  // la 6 (Mi grave, la más gruesa) abajo.
  const STRING_OPEN_NOTES = { 1: "E", 2: "B", 3: "G", 4: "D", 5: "A", 6: "E" };
  const STRING_ORDER_TOP_TO_BOTTOM = [1, 2, 3, 4, 5, 6];

  // Frecuencia real (Hz, afinación estándar A440) de cada cuerda al aire, para sintetizar el
  // sonido con la altura exacta de cada traste (no solo el nombre de la nota).
  const STRING_OPEN_FREQ = { 1: 329.6276, 2: 246.9417, 3: 195.9977, 4: 146.8324, 5: 110.0, 6: 82.4069 };

  function getFrequencyAtFret(stringNum, fret) {
    return STRING_OPEN_FREQ[stringNum] * Math.pow(2, fret / 12);
  }

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
    soundBtn: document.querySelector("#guitarNotesSoundBtn"),
    historyText: document.querySelector("#guitarNotesHistoryText"),
    gameCard: document.querySelector("#guitarNotesGameCard")
  };

  const state = {
    config: null,
    gnConfig: null,
    difficulty: 2,
    soundOn: true,
    current: null,
    answered: false,
    timerStart: null,
    timerInterval: null,
    secondsLeft: 0,
    roundQuestionNumber: 0,
    roundCorrect: 0,
    roundStartTime: null,
    autoNextTimerId: null,
    advanceNow: null,
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

  const FRET_WIDE_PX = 52; // ancho de los trastes 0-11, como el tramo ancho de una guitarra real
  const FRET_MIN_PX = 26; // ancho mínimo al que se puede angostar en los trastes agudos

  // Del traste 12 en adelante se va angostando (como el diapasón real, donde los trastes
  // agudos quedan más juntos); antes de eso se mantiene ancho y cómodo para tocar.
  function fretColumnWidth(fret) {
    if (fret <= 11) return FRET_WIDE_PX;
    const ratio = Math.pow(2, -(fret - 11) / 12);
    return Math.max(FRET_MIN_PX, Math.round(FRET_WIDE_PX * ratio));
  }

  function buildGridCols(fretsCount) {
    const cols = [];
    for (let f = 0; f <= fretsCount; f++) cols.push(`${fretColumnWidth(f)}px`);
    return `40px ${cols.join(" ")}`;
  }

  // Posición X (px) del borde derecho de la celda del traste `fret` — ahí va el trastecito
  // metálico que lo cierra.
  function fretBoundaryX(fret) {
    let x = 40;
    for (let i = 0; i <= fret; i++) x += fretColumnWidth(i);
    return x;
  }

  function renderFretboard() {
    const gn = state.gnConfig;
    const enabledSet = new Set(gn.enabledStrings);
    const gridCols = buildGridCols(gn.fretsCount);

    els.fretboardInner.innerHTML = "";

    // Envoltorio de las 6 cuerdas: se queda "relative" para que los puntos de referencia se
    // dibujen encima de él, en el fondo del diapasón (detrás de las cuerdas), en vez de en
    // una fila aparte.
    const stringsWrap = document.createElement("div");
    stringsWrap.className = "fretboard-strings-wrap";

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
      stringsWrap.appendChild(row);
    });

    // Puntos de referencia del diapasón real (3,5,7,9,15,17,19,21 simples; 12 y 24 dobles),
    // superpuestos detrás de las cuerdas: el simple centrado entre la 3ª y 4ª cuerda (el medio
    // del diapasón), el doble con un punto entre la 2ª-3ª y otro entre la 4ª-5ª.
    const markers = document.createElement("div");
    markers.className = "fretboard-markers";
    markers.style.gridTemplateColumns = gridCols;
    for (let f = 0; f <= gn.fretsCount; f++) {
      const col = f + 2; // +1 por la columna de la etiqueta, +1 porque grid-column empieza en 1
      if (DOUBLE_MARKER_FRETS.has(f)) {
        markers.appendChild(createMarkerDot(col, 2, 4));
        markers.appendChild(createMarkerDot(col, 4, 6));
      } else if (SINGLE_MARKER_FRETS.has(f)) {
        markers.appendChild(createMarkerDot(col, 3, 5));
      }
    }
    stringsWrap.appendChild(markers);

    // Trastes metálicos: una barrita por cada división entre trastes (del 1 en adelante; la
    // del 0 es la cejuela marrón). Van debajo de las cuerdas pero encima del diapasón/puntos,
    // igual que en una guitarra real.
    const frets = document.createElement("div");
    frets.className = "fretboard-frets";
    for (let f = 1; f <= gn.fretsCount; f++) {
      const wire = document.createElement("div");
      wire.className = "fret-wire";
      wire.style.left = `${fretBoundaryX(f)}px`;
      frets.appendChild(wire);
    }
    stringsWrap.appendChild(frets);

    // Cejuela: barrita marrón entre el traste 0 y el 1, para distinguir la cuerda al aire
    // (nota natural, a la izquierda) de los trastes pisados (a la derecha).
    const nutBar = document.createElement("div");
    nutBar.className = "fretboard-nut";
    nutBar.style.left = `${fretBoundaryX(0)}px`;
    stringsWrap.appendChild(nutBar);

    els.fretboardInner.appendChild(stringsWrap);

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

  function createMarkerDot(col, rowStart, rowEnd) {
    const dot = document.createElement("span");
    dot.className = "fret-marker-dot";
    dot.style.gridColumn = String(col);
    dot.style.gridRow = `${rowStart} / ${rowEnd}`;
    return dot;
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
    playFret(stringNum, fret);
    resolveAnswer({ clickedString: stringNum, clickedFret: fret, clickedNote: getNoteAtFret(stringNum, fret) });
  }

  function playFret(stringNum, fret, volume) {
    if (!state.soundOn || !window.GuitarSynth) return;
    GuitarSynth.pluck(getFrequencyAtFret(stringNum, fret), { volume });
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
      // Deja oír cómo suena realmente la nota correcta, para reforzar el oído.
      setTimeout(() => playFret(q.string, q.fret, 0.45), 400);
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

    scheduleNext(elapsedMs / 1000, correct);
  }

  // Encadena el aviso de "cuánto tardaste" antes de pasar a la siguiente nota.
  // Mientras el mensaje está en pantalla no arranca el temporizador de la
  // siguiente pregunta; recién avanza cuando la promesa se resuelve o el
  // jugador pulsa "Siguiente nota" / Enter.
  function scheduleNext(elapsedSeconds, correct) {
    clearTimeout(state.autoNextTimerId);
    state.autoNextTimerId = null;

    let advanced = false;
    const advance = () => {
      if (advanced) return;
      advanced = true;
      clearTimeout(state.autoNextTimerId);
      state.autoNextTimerId = null;
      state.advanceNow = null;
      nextQuestion();
    };
    state.advanceNow = advance;

    if (TimeToast.isEnabled()) {
      TimeToast.show(elapsedSeconds).then(advance);
    } else {
      state.autoNextTimerId = setTimeout(
        advance,
        correct ? AUTO_NEXT_DELAY_CORRECT_MS : AUTO_NEXT_DELAY_INCORRECT_MS
      );
    }
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
    TimeToast.skip();
    state.advanceNow = null;
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

  function loadSoundPreference(defaultOn) {
    const stored = localStorage.getItem(STORAGE_SOUND_KEY);
    return stored === null ? defaultOn : stored === "1";
  }

  function setSound(on) {
    state.soundOn = on;
    localStorage.setItem(STORAGE_SOUND_KEY, on ? "1" : "0");
    if (window.GuitarSynth) GuitarSynth.setMuted(!on);
    if (els.soundBtn) {
      els.soundBtn.textContent = on ? "🔊 Sonido" : "🔇 Sonido";
      els.soundBtn.setAttribute("aria-pressed", String(on));
    }
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
    TimeToast.skip();
    if (state.advanceNow) state.advanceNow();
  }

  function teardown() {
    stopTimer();
    clearTimeout(state.autoNextTimerId);
    TimeToast.skip();
    state.advanceNow = null;
  }

  async function start() {
    try {
      const response = await fetch("/api/game-data");
      if (!response.ok) throw new Error("No fue posible cargar los datos.");
      const data = await response.json();

      state.config = data.config;
      TimeToast.init(data.config);
      state.gnConfig = normalizeConfig(data.config);
      state.difficulty = loadDifficulty(state.gnConfig.difficulty);
      state.gnConfig.difficulty = state.difficulty;
      setDifficulty(state.difficulty);

      const gnSoundDefault = data.config.guitarNotes ? data.config.guitarNotes.soundEnabled !== false : true;
      setSound(loadSoundPreference(gnSoundDefault));

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

  els.nextBtn.addEventListener("click", () => {
    TimeToast.skip();
    if (state.advanceNow) state.advanceNow();
  });
  els.newRoundBtn.addEventListener("click", startRound);

  els.difficultyRow.querySelectorAll(".difficulty-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setDifficulty(Number(btn.dataset.difficulty));
      startRound();
    });
  });

  document.addEventListener("keydown", handleGlobalEnter);

  if (els.soundBtn) {
    els.soundBtn.addEventListener("click", () => setSound(!state.soundOn));
  }

  els.backBtn.addEventListener("click", () => {
    teardown();
    document.dispatchEvent(new CustomEvent("app:back-to-menu"));
  });

  return { start, teardown };
})();
