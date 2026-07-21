const state = {
  config: null,
  scales: [],
  questionNumber: 0,
  score: 0,
  streak: 0,
  answered: false,
  timerId: null,
  autoNextTimerId: null,
  totalTimerId: null,
  secondsLeft: 0,
  currentQuestion: null,
  startTime: null
};

const AUTO_NEXT_DELAY_CORRECT_MS = 2000;
const AUTO_NEXT_DELAY_INCORRECT_MS = 3000;

const els = {
  score: document.querySelector("#score"),
  streak: document.querySelector("#streak"),
  currentQuestion: document.querySelector("#currentQuestion"),
  totalQuestions: document.querySelector("#totalQuestions"),
  timer: document.querySelector("#timer"),
  progress: document.querySelector("#progressBar div"),
  scaleBadge: document.querySelector("#scaleBadge"),
  questionText: document.querySelector("#questionText"),
  answerForm: document.querySelector("#answerForm"),
  answerInput: document.querySelector("#answerInput"),
  feedback: document.querySelector("#feedback"),
  nextBtn: document.querySelector("#nextBtn"),
  questionArea: document.querySelector("#questionArea"),
  resultArea: document.querySelector("#resultArea"),
  totalTime: document.querySelector("#totalTime"),
  finalScore: document.querySelector("#finalScore"),
  finalTime: document.querySelector("#finalTime"),
  avgTime: document.querySelector("#avgTime"),
  finalMessage: document.querySelector("#finalMessage"),
  activeScalesText: document.querySelector("#activeScalesText"),
  restartBtn: document.querySelector("#restartBtn"),
  playAgainBtn: document.querySelector("#playAgainBtn"),
  backBtn: document.querySelector("#scalesBackBtn")
};

const degreeNames = {
  1: "primera",
  2: "segunda",
  3: "tercera",
  4: "cuarta",
  5: "quinta",
  6: "sexta",
  7: "séptima"
};

function isCorrectAnswer(answer, expected) {
  const normalizedAnswer = MusicTheory.normalizeNoteName(answer);
  const normalizedExpected = MusicTheory.normalizeNoteName(expected);

  if (normalizedAnswer === normalizedExpected) return true;
  if (!state.config.allowEnharmonicAnswers) return false;

  return MusicTheory.isEnharmonicMatch(normalizedAnswer, normalizedExpected);
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function createQuestion() {
  const scale = randomItem(state.scales);
  const degree = randomItem(state.config.enabledDegrees);
  const allowedTypes = state.config.questionTypes || ["degreeToNote"];
  const type = randomItem(allowedTypes);

  if (type === "noteToDegree") {
    const note = scale.notes[degree - 1];
    return {
      type,
      scale,
      degree,
      note,
      answer: String(degree),
      text: `¿Qué grado ocupa ${note} en la escala de ${scale.tonic} mayor?`
    };
  }

  return {
    type: "degreeToNote",
    scale,
    degree,
    note: scale.notes[degree - 1],
    answer: scale.notes[degree - 1],
    text: `¿Cuál es la ${degreeNames[degree]} nota de ${scale.tonic} mayor?`
  };
}

function renderQuestion() {
  clearInterval(state.timerId);
  state.answered = false;
  state.currentQuestion = createQuestion();
  state.questionNumber += 1;

  els.currentQuestion.textContent = state.questionNumber;
  els.totalQuestions.textContent = state.config.questionsPerRound;
  els.scaleBadge.textContent = state.currentQuestion.scale.name;
  els.questionText.textContent = state.currentQuestion.text;
  els.answerInput.value = "";
  els.answerInput.disabled = false;
  els.answerInput.placeholder =
    state.currentQuestion.type === "noteToDegree" ? "Ejemplo: 3" : "Ejemplo: F#";
  els.feedback.className = "feedback hidden";
  els.feedback.textContent = "";
  els.nextBtn.classList.add("hidden");
  els.progress.style.width =
    `${((state.questionNumber - 1) / state.config.questionsPerRound) * 100}%`;

  startTimer();
  setTimeout(() => els.answerInput.focus(), 50);
}

function startTimer() {
  state.secondsLeft = state.config.timePerQuestionSeconds;
  els.timer.textContent = state.secondsLeft;

  state.timerId = setInterval(() => {
    state.secondsLeft -= 1;
    els.timer.textContent = state.secondsLeft;

    if (state.secondsLeft <= 0) {
      clearInterval(state.timerId);
      evaluateAnswer("", true);
    }
  }, 1000);
}

function evaluateAnswer(rawAnswer, timedOut = false) {
  if (state.answered) return;

  state.answered = true;
  clearInterval(state.timerId);
  els.answerInput.disabled = true;

  const expected = state.currentQuestion.answer;
  const correct = !timedOut && isCorrectAnswer(rawAnswer, expected);

  if (correct) {
    state.streak += 1;
    const timeBonus = Math.max(0, state.secondsLeft);
    const streakBonus = Math.min(state.streak * 2, 20);
    const earned = 10 + timeBonus + streakBonus;
    state.score += earned;

    els.feedback.className = "feedback correct";
    els.feedback.textContent =
      `¡Correcto! +${earned} puntos. ${buildScaleExplanation()}`;
  } else {
    state.streak = 0;
    els.feedback.className = "feedback incorrect";
    els.feedback.textContent = timedOut
      ? `Se acabó el tiempo. La respuesta era ${expected}. ${buildScaleExplanation()}`
      : `Casi. La respuesta correcta es ${expected}. ${buildScaleExplanation()}`;
  }

  els.score.textContent = state.score;
  els.streak.textContent = state.streak;
  els.nextBtn.classList.remove("hidden");
  els.nextBtn.focus();

  clearTimeout(state.autoNextTimerId);
  state.autoNextTimerId = setTimeout(
    nextQuestion,
    correct ? AUTO_NEXT_DELAY_CORRECT_MS : AUTO_NEXT_DELAY_INCORRECT_MS
  );
}

function buildScaleExplanation() {
  if (!state.config.showScaleAfterAnswer) return "";
  const scale = state.currentQuestion.scale;
  return `${scale.name}: ${scale.notes.join(" – ")}.`;
}

function nextQuestion() {
  clearTimeout(state.autoNextTimerId);
  if (state.questionNumber >= state.config.questionsPerRound) {
    finishRound();
    return;
  }
  renderQuestion();
}

function formatDuration(totalMs) {
  const totalSeconds = Math.round(totalMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function updateTotalTime() {
  els.totalTime.textContent = formatDuration(Date.now() - state.startTime);
}

function finishRound() {
  clearInterval(state.timerId);
  clearTimeout(state.autoNextTimerId);
  clearInterval(state.totalTimerId);
  els.progress.style.width = "100%";
  els.questionArea.classList.add("hidden");
  els.resultArea.classList.remove("hidden");
  const elapsedMs = Date.now() - state.startTime;
  els.finalScore.textContent = state.score;
  els.finalTime.textContent = formatDuration(elapsedMs);
  els.avgTime.textContent = formatDuration(elapsedMs / state.questionNumber);

  const maxRoughScore = state.config.questionsPerRound * 45;
  const ratio = state.score / maxRoughScore;

  els.finalMessage.textContent =
    ratio >= 0.75
      ? "Excelente dominio. Tus respuestas ya son muy rápidas."
      : ratio >= 0.45
        ? "Buen progreso. Sigue reforzando las escalas menos familiares."
        : "Buen comienzo. La repetición diaria hará que las respuestas sean automáticas.";
}

function resetGame() {
  clearInterval(state.timerId);
  clearTimeout(state.autoNextTimerId);
  clearInterval(state.totalTimerId);
  state.questionNumber = 0;
  state.score = 0;
  state.streak = 0;
  state.answered = false;
  state.startTime = Date.now();

  els.score.textContent = "0";
  els.streak.textContent = "0";
  updateTotalTime();
  state.totalTimerId = setInterval(updateTotalTime, 1000);
  els.questionArea.classList.remove("hidden");
  els.resultArea.classList.add("hidden");
  renderQuestion();
}

function teardownScalesMode() {
  clearInterval(state.timerId);
  clearTimeout(state.autoNextTimerId);
  clearInterval(state.totalTimerId);
}

async function loadGame() {
  const response = await fetch("/api/game-data");
  if (!response.ok) {
    throw new Error("No fue posible cargar los datos.");
  }

  const data = await response.json();
  state.config = data.config;
  state.scales = data.scales;

  if (!state.scales.length) {
    throw new Error("No hay escalas válidas configuradas.");
  }

  els.totalQuestions.textContent = state.config.questionsPerRound;
  els.activeScalesText.textContent = state.scales
    .map((scale) => scale.tonic)
    .join(" · ");

  resetGame();
}

els.answerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  evaluateAnswer(els.answerInput.value);
});

els.nextBtn.addEventListener("click", nextQuestion);
els.restartBtn.addEventListener("click", resetGame);
els.playAgainBtn.addEventListener("click", resetGame);
els.backBtn.addEventListener("click", () => {
  teardownScalesMode();
  document.dispatchEvent(new CustomEvent("app:back-to-menu"));
});

window.ScalesMode = {
  start() {
    loadGame().catch((error) => {
      console.error(error);
      els.questionText.textContent = "No se pudo iniciar el juego.";
      els.feedback.className = "feedback incorrect";
      els.feedback.textContent = error.message;
    });
  },
  teardown: teardownScalesMode
};
