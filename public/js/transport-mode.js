const TransportMode = (function () {
  const STORAGE_STATS_KEY = "transportStats";
  const STORAGE_DIFFICULTY_KEY = "transportDifficulty";

  const els = {
    difficultyRow: document.querySelector("#difficultyRow"),
    exercises: document.querySelector("#tExercises"),
    accuracy: document.querySelector("#tAccuracy"),
    streak: document.querySelector("#tStreak"),
    bestStreak: document.querySelector("#tBestStreak"),
    error: document.querySelector("#transportError"),
    content: document.querySelector("#transportContent"),
    fromKeyBadge: document.querySelector("#fromKeyBadge"),
    toKeyBadge: document.querySelector("#toKeyBadge"),
    originProgression: document.querySelector("#originProgression"),
    form: document.querySelector("#transportForm"),
    chordRows: document.querySelector("#chordRows"),
    checkBtn: document.querySelector("#transportCheckBtn"),
    result: document.querySelector("#transportResult"),
    resultSummary: document.querySelector("#transportResultSummary"),
    resultRoman: document.querySelector("#transportRoman"),
    nextBtn: document.querySelector("#transportNextBtn"),
    backBtn: document.querySelector("#transportBackBtn"),
    historyText: document.querySelector("#transpositionHistoryText")
  };

  const state = {
    config: null,
    scales: [],
    difficulty: 2,
    current: null,
    answered: false,
    stats: loadStats()
  };

  function loadStats() {
    try {
      const raw = localStorage.getItem(STORAGE_STATS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (error) {
      console.warn("No se pudieron leer las estadísticas de transporte.", error);
    }
    return {
      exercises: 0,
      chordsAnswered: 0,
      correct: 0,
      incorrect: 0,
      currentStreak: 0,
      bestStreak: 0,
      byTransposition: {}
    };
  }

  function saveStats() {
    localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(state.stats));
  }

  function loadDifficulty(defaultDifficulty) {
    const stored = Number(localStorage.getItem(STORAGE_DIFFICULTY_KEY));
    return stored >= 1 && stored <= 3 ? stored : defaultDifficulty;
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function chordsMatch(userInput, expectedSymbol) {
    const parsedInput = MusicTheory.parseChordSymbol(userInput);
    const parsedExpected = MusicTheory.parseChordSymbol(expectedSymbol);
    if (!parsedInput || !parsedExpected) return false;
    if (parsedInput.quality !== parsedExpected.quality) return false;

    if (MusicTheory.normalizeNoteName(parsedInput.root) === MusicTheory.normalizeNoteName(parsedExpected.root)) {
      return true;
    }
    if (!state.config.allowEnharmonicAnswers) return false;
    return MusicTheory.isEnharmonicMatch(parsedInput.root, parsedExpected.root);
  }

  function setDifficulty(level) {
    state.difficulty = level;
    localStorage.setItem(STORAGE_DIFFICULTY_KEY, String(level));
    els.difficultyRow.querySelectorAll(".difficulty-btn").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.difficulty) === level);
    });
  }

  function updateStatsUI() {
    const accuracy = state.stats.chordsAnswered
      ? Math.round((state.stats.correct / state.stats.chordsAnswered) * 100)
      : 0;

    els.exercises.textContent = state.stats.exercises;
    els.accuracy.textContent = `${accuracy}%`;
    els.streak.textContent = state.stats.currentStreak;
    els.bestStreak.textContent = state.stats.bestStreak;

    renderTranspositionHistory();
  }

  function renderTranspositionHistory() {
    const entries = Object.entries(state.stats.byTransposition).filter(([, v]) => v.total > 0);
    if (!entries.length) {
      els.historyText.textContent = "Aún no hay datos suficientes.";
      return;
    }

    els.historyText.textContent = entries
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => `${key}: ${Math.round((value.correct / value.total) * 100)}%`)
      .join("  ·  ");
  }

  function generateExercise() {
    state.answered = false;
    els.result.classList.add("hidden");

    if (state.scales.length < 2) {
      els.error.textContent =
        "Necesitas al menos 2 tonalidades habilitadas en config/game-config.json para practicar transporte.";
      els.error.classList.remove("hidden");
      els.content.classList.add("hidden");
      return;
    }

    els.error.classList.add("hidden");
    els.content.classList.remove("hidden");

    const fromScale = randomItem(state.scales);
    const toScale = randomItem(state.scales.filter((scale) => scale.tonic !== fromScale.tonic));
    const degrees = MusicTheory.generateProgression(state.difficulty);
    const diatonicFrom = MusicTheory.getDiatonicChords(fromScale);
    const originChords = degrees.map((d) => diatonicFrom[d.degree - 1]);
    const originSymbols = originChords.map((chord) => chord.symbol);
    const transposed = MusicTheory.transposeProgression(originSymbols, fromScale, toScale);

    state.current = { fromScale, toScale, chords: transposed };
    renderExercise();
  }

  function renderExercise() {
    const { fromScale, toScale, chords } = state.current;

    els.fromKeyBadge.textContent = fromScale.tonic;
    els.toKeyBadge.textContent = toScale.tonic;
    els.originProgression.textContent = chords.map((c) => c.original).join(" – ");

    els.chordRows.innerHTML = "";
    chords.forEach((chord, index) => {
      const row = document.createElement("div");
      row.className = "chord-row";

      const origin = document.createElement("span");
      origin.className = "chord-origin";
      origin.textContent = chord.original;

      const arrow = document.createElement("span");
      arrow.className = "chord-row-arrow";
      arrow.textContent = "→";

      const input = document.createElement("input");
      input.type = "text";
      input.className = "chord-input";
      input.dataset.index = String(index);
      input.autocomplete = "off";
      input.placeholder = `Ej: ${chord.target.symbol}`;
      input.setAttribute("aria-label", `Transporte de ${chord.original}`);

      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const next = els.chordRows.querySelector(`.chord-input[data-index="${index + 1}"]`);
        if (next) {
          next.focus();
        } else {
          els.form.requestSubmit();
        }
      });

      const result = document.createElement("span");
      result.className = "chord-result";

      row.append(origin, arrow, input, result);
      els.chordRows.appendChild(row);
    });

    els.checkBtn.disabled = false;
    els.checkBtn.classList.remove("hidden");
    els.form.classList.remove("hidden");

    setTimeout(() => {
      const firstInput = els.chordRows.querySelector(".chord-input");
      if (firstInput) firstInput.focus();
    }, 30);
  }

  function checkAnswers() {
    if (state.answered) return;
    state.answered = true;

    const { fromScale, toScale, chords } = state.current;
    const pairKey = `${fromScale.tonic}→${toScale.tonic}`;
    state.stats.byTransposition[pairKey] = state.stats.byTransposition[pairKey] || {
      correct: 0,
      total: 0
    };

    let correctCount = 0;

    chords.forEach((chord, index) => {
      const input = els.chordRows.querySelector(`.chord-input[data-index="${index}"]`);
      const resultEl = input.parentElement.querySelector(".chord-result");
      const isCorrect = chordsMatch(input.value, chord.target.symbol);

      input.disabled = true;
      input.classList.toggle("input-correct", isCorrect);
      input.classList.toggle("input-incorrect", !isCorrect);

      if (isCorrect) {
        correctCount += 1;
        resultEl.textContent = "✓";
        resultEl.className = "chord-result correct";
      } else {
        resultEl.textContent = `✗ Correcto: ${chord.target.symbol}`;
        resultEl.className = "chord-result incorrect";
      }

      if (state.config.transport && state.config.transport.showDegreesAfterAnswer !== false) {
        const romanNote = document.createElement("span");
        romanNote.className = "chord-roman";
        romanNote.textContent = `(${chord.originalDegree.roman})`;
        resultEl.appendChild(romanNote);
      }

      state.stats.chordsAnswered += 1;
      state.stats.byTransposition[pairKey].total += 1;

      if (isCorrect) {
        state.stats.correct += 1;
        state.stats.byTransposition[pairKey].correct += 1;
        state.stats.currentStreak += 1;
        state.stats.bestStreak = Math.max(state.stats.bestStreak, state.stats.currentStreak);
      } else {
        state.stats.incorrect += 1;
        state.stats.currentStreak = 0;
      }
    });

    state.stats.exercises += 1;
    saveStats();
    updateStatsUI();

    const percentage = Math.round((correctCount / chords.length) * 100);
    els.resultSummary.textContent = `${correctCount} / ${chords.length} correctas · ${percentage}%`;

    if (state.config.transport && state.config.transport.showDegreesAfterAnswer !== false) {
      els.resultRoman.textContent = `Progresión: ${chords.map((c) => c.originalDegree.roman).join(" - ")}`;
      els.resultRoman.classList.remove("hidden");
    } else {
      els.resultRoman.classList.add("hidden");
    }

    els.checkBtn.classList.add("hidden");
    els.result.classList.remove("hidden");
    els.nextBtn.focus();
  }

  function handleGlobalEnter(event) {
    if (event.key !== "Enter") return;
    if (!state.answered) return;
    if (els.content.classList.contains("hidden")) return;
    if (document.querySelector("#transportView").classList.contains("hidden")) return;

    event.preventDefault();
    generateExercise();
  }

  function teardown() {
    // No timers/intervals to clear in transport mode.
  }

  async function start() {
    try {
      const response = await fetch("/api/game-data");
      if (!response.ok) throw new Error("No fue posible cargar los datos.");
      const data = await response.json();

      state.config = data.config;
      state.scales = data.scales;
      state.difficulty = loadDifficulty((data.config.transport && data.config.transport.difficulty) || 2);
      setDifficulty(state.difficulty);

      updateStatsUI();
      generateExercise();
    } catch (error) {
      console.error(error);
      els.error.textContent = error.message;
      els.error.classList.remove("hidden");
      els.content.classList.add("hidden");
    }
  }

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    checkAnswers();
  });

  els.nextBtn.addEventListener("click", generateExercise);

  els.difficultyRow.querySelectorAll(".difficulty-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setDifficulty(Number(btn.dataset.difficulty));
      generateExercise();
    });
  });

  document.addEventListener("keydown", handleGlobalEnter);

  els.backBtn.addEventListener("click", () => {
    teardown();
    document.dispatchEvent(new CustomEvent("app:back-to-menu"));
  });

  return { start, teardown };
})();
