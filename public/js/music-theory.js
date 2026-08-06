/**
 * Lógica musical compartida entre el modo Escalas y el modo Transporte.
 * No depende del DOM: recibe objetos de escala (los que sirve /api/game-data)
 * y devuelve datos puros para que cada modo los renderice a su manera.
 */
(function () {
  const DEGREE_QUALITIES = ["major", "minor", "minor", "major", "major", "minor", "dim"];
  const ROMAN_NUMERALS = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];

  const ENHARMONIC_MAP = {
    "C#": ["DB"],
    DB: ["C#"],
    "D#": ["EB"],
    EB: ["D#"],
    "F#": ["GB"],
    GB: ["F#"],
    "G#": ["AB"],
    AB: ["G#"],
    "A#": ["BB"],
    BB: ["A#"],
    "B#": ["C"],
    CB: ["B"],
    "E#": ["F"],
    FB: ["E"],
    "F##": ["G"],
    "C##": ["D"],
    "G##": ["A"]
  };

  function normalizeNoteName(value) {
    return String(value)
      .trim()
      .toUpperCase()
      .replaceAll("♯", "#")
      .replaceAll("♭", "B")
      .replace(/\s+/g, "");
  }

  function isEnharmonicMatch(answerNote, expectedNote) {
    const normalizedAnswer = normalizeNoteName(answerNote);
    const normalizedExpected = normalizeNoteName(expectedNote);
    if (normalizedAnswer === normalizedExpected) return true;
    return (ENHARMONIC_MAP[normalizedExpected] || []).includes(normalizedAnswer);
  }

  function formatChordSymbol(root, quality) {
    if (quality === "minor") return `${root}m`;
    if (quality === "dim") return `${root}dim`;
    return root;
  }

  /** Devuelve los 7 acordes diatónicos de una escala mayor, en orden de grado. */
  function getDiatonicChords(scale) {
    return scale.notes.map((root, index) => {
      const quality = DEGREE_QUALITIES[index];
      return {
        degree: index + 1,
        roman: ROMAN_NUMERALS[index],
        root,
        quality,
        symbol: formatChordSymbol(root, quality)
      };
    });
  }

  /** Interpreta un símbolo de acorde escrito por el usuario o generado ("C", "Am", "F#dim", "Bb"). */
  function parseChordSymbol(symbol) {
    const match = String(symbol || "")
      .trim()
      .match(/^([A-Ga-g])(#{1,2}|b)?(.*)$/);
    if (!match) return null;

    const root = match[1].toUpperCase() + (match[2] || "");
    const rest = match[3].trim().toLowerCase();

    let quality = "major";
    if (rest.startsWith("dim") || rest === "°" || rest === "o") {
      quality = "dim";
    } else if (rest.startsWith("m") && !rest.startsWith("maj")) {
      quality = "minor";
    }

    return { root, quality, symbol: formatChordSymbol(root, quality) };
  }

  /** Encuentra a qué grado diatónico de `scale` pertenece un acorde dado. */
  function getChordDegree(chordSymbol, scale) {
    const parsed = parseChordSymbol(chordSymbol);
    if (!parsed) return null;

    const diatonicChords = getDiatonicChords(scale);
    return (
      diatonicChords.find(
        (chord) => normalizeNoteName(chord.root) === normalizeNoteName(parsed.root)
      ) || null
    );
  }

  /** Transporta un único acorde de `fromScale` a `toScale`, conservando el grado. */
  function transposeChord(chordSymbol, fromScale, toScale) {
    const fromDegree = getChordDegree(chordSymbol, fromScale);
    if (!fromDegree) return null;
    return getDiatonicChords(toScale)[fromDegree.degree - 1];
  }

  /**
   * Transporta una progresión completa. Devuelve, por cada acorde:
   * { original, originalDegree, target } donde target es el acorde diatónico
   * de `toScale` en el mismo grado.
   */
  function transposeProgression(chordSymbols, fromScale, toScale) {
    return chordSymbols.map((chordSymbol) => {
      const originalDegree = getChordDegree(chordSymbol, fromScale);
      const target = originalDegree ? getDiatonicChords(toScale)[originalDegree.degree - 1] : null;
      return { original: chordSymbol, originalDegree, target };
    });
  }

  function romanToDegree(roman) {
    const index = ROMAN_NUMERALS.indexOf(roman);
    return index === -1 ? null : index + 1;
  }

  const ROMAN_VALUES = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 };

  /**
   * Interpreta el grado escrito por el usuario. Acepta el número de posición
   * ("6", "6°") o el número romano en cualquier caja ("vi", "VI", "vii°", "viidim").
   * Devuelve 1-7 o null si no se entiende.
   */
  function parseDegreeAnswer(value) {
    const cleaned = String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[°ºO]+$/, "")
      .replace(/DIM$/, "")
      .replace(/[\s.\-]/g, "");
    if (!cleaned) return null;

    if (/^[1-7]$/.test(cleaned)) return Number(cleaned);
    if (Object.prototype.hasOwnProperty.call(ROMAN_VALUES, cleaned)) return ROMAN_VALUES[cleaned];
    return null;
  }

  // Patrones de progresiones por grados, agrupados por nivel de dificultad.
  const PROGRESSION_PATTERNS = {
    1: [
      ["I", "IV", "V"],
      ["I", "V", "IV"],
      ["IV", "V", "I"],
      ["V", "IV", "I"]
    ],
    2: [
      ["I", "V", "vi", "IV"],
      ["I", "vi", "IV", "V"],
      ["vi", "IV", "I", "V"],
      ["I", "IV", "vi", "V"],
      ["I", "ii", "IV", "V"],
      ["vi", "ii", "IV", "V"]
    ],
    3: [
      ["ii", "V", "I"],
      ["I", "iii", "IV", "V"],
      ["vi", "V", "IV", "I"],
      ["I", "vii°", "vi", "V"],
      ["iii", "vi", "IV", "V"],
      ["I", "V", "vi", "IV"],
      ["I", "vi", "IV", "V"]
    ]
  };

  function generateProgression(difficulty) {
    const patterns = PROGRESSION_PATTERNS[difficulty] || PROGRESSION_PATTERNS[2];
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    return pattern.map((roman) => ({ roman, degree: romanToDegree(roman) }));
  }

  window.MusicTheory = {
    DEGREE_QUALITIES,
    ROMAN_NUMERALS,
    ENHARMONIC_MAP,
    normalizeNoteName,
    isEnharmonicMatch,
    formatChordSymbol,
    parseChordSymbol,
    getDiatonicChords,
    getChordDegree,
    transposeChord,
    transposeProgression,
    generateProgression,
    romanToDegree,
    parseDegreeAnswer
  };
})();
