const state = {
  config: null,
  scales: [],
  questionNumber: 0,
  score: 0,
  streak: 0,
  answered: false,
  timerId: null,
  secondsLeft: 0,
  currentQuestion: null
};

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
  finalScore: document.querySelector("#finalScore"),
  finalMessage: document.querySelector("#finalMessage"),
  activeScalesText: document.querySelector("#activeScalesText"),
  restartBtn: document.querySelector("#restartBtn"),
  playAgainBtn: document.querySelector("#playAgainBtn")
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

const enharmonicMap = {
  "C#": ["DB"],
  "DB": ["C#"],
  "D#": ["EB"],
  "EB": ["D#"],
  "F#": ["GB"],
  "GB": ["F#"],
  "G#": ["AB"],
  "AB": ["G#"],
  "A#": ["BB"],
  "BB": ["A#"],
  "B#": ["C"],
  "CB": ["B"],
  "E#": ["F"],
  "FB": ["E"],
  "F##": ["G"],
  "C##": ["D"],
  "G##": ["A"]
};

function normalizeNote(value) {
  return value
    .trim()
    .toUpperCase()
    .replaceAll("♯", "#")
    .replaceAll("♭", "B")
    .replace(/\s+/g, "");
}

function isCorrectAnswer(answer, expected) {
  const normalizedAnswer = normalizeNote(answer);
  const normalizedExpected = normalizeNote(expected);

  if (normalizedAnswer === normalizedExpected) return true;
  if (!state.config.allowEnharmonicAnswers) return false;

  return (enharmonicMap[normalizedExpected] || []).includes(normalizedAnswer);
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
}

function buildScaleExplanation() {
  if (!state.config.showScaleAfterAnswer) return "";
  const scale = state.currentQuestion.scale;
  return `${scale.name}: ${scale.notes.join(" – ")}.`;
}

function nextQuestion() {
  if (state.questionNumber >= state.config.questionsPerRound) {
    finishRound();
    return;
  }
  renderQuestion();
}

function finishRound() {
  clearInterval(state.timerId);
  els.progress.style.width = "100%";
  els.questionArea.classList.add("hidden");
  els.resultArea.classList.remove("hidden");
  els.finalScore.textContent = state.score;

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
  state.questionNumber = 0;
  state.score = 0;
  state.streak = 0;
  state.answered = false;

  els.score.textContent = "0";
  els.streak.textContent = "0";
  els.questionArea.classList.remove("hidden");
  els.resultArea.classList.add("hidden");
  renderQuestion();
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

loadGame().catch((error) => {
  console.error(error);
  els.questionText.textContent = "No se pudo iniciar el juego.";
  els.feedback.className = "feedback incorrect";
  els.feedback.textContent = error.message;
});
