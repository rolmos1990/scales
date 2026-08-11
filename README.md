# Scale Quest

Juego web sencillo para practicar escalas mayores y sus grados.

## Requisitos

- Node.js 18 o superior
- npm

## Ejecutar

```bash
npm install
npm start
```

Abre:

```text
http://localhost:3000
```

Durante desarrollo también puedes usar:

```bash
npm run dev
```

## Configurar las escalas

Edita:

```text
config/game-config.json
```

Ejemplo para practicar solamente C, D, E, F y G:

```json
{
  "enabledScales": ["C", "D", "E", "F", "G"],
  "questionTypes": ["degreeToNote", "noteToDegree"],
  "enabledDegrees": [1, 3, 5],
  "questionsPerRound": 15,
  "timePerQuestionSeconds": 20,
  "allowEnharmonicAnswers": true,
  "showScaleAfterAnswer": true
}
```

Ejemplo con sostenidos y bemoles:

```json
"enabledScales": ["C#", "Gb", "Bb", "Eb"]
```

## Tipos de pregunta

- `degreeToNote`: pregunta cuál nota corresponde a un grado.
- `noteToDegree`: pregunta qué grado ocupa una nota.

Puedes dejar solamente uno:

```json
"questionTypes": ["degreeToNote"]
```

## Grados

Para practicar únicamente primera, tercera y quinta:

```json
"enabledDegrees": [1, 3, 5]
```

Para practicar todos los grados:

```json
"enabledDegrees": [1, 2, 3, 4, 5, 6, 7]
```

## Notas Guitarra

Modo para ubicar notas en el diapasón mediante un diagrama interactivo (6 cuerdas × trastes,
con los puntos de referencia habituales en 3, 5, 7, 9, 12, 15, 17, 19, 21 y 24): te pide una
nota (o una nota + cuerda, según la dificultad) y debes presionar el traste correcto.

Orientación tipo tablatura: arriba la cuerda 1 (Mi agudo, la más fina), abajo la cuerda 6
(Mi grave, la más gruesa) — afinación estándar.

```json
"guitarNotes": {
  "enabledStrings": [1, 2, 3, 4, 5, 6],
  "enabledNotes": ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
  "difficulty": 2,
  "fretsCount": 15,
  "questionsPerRound": 15,
  "timePerQuestionSeconds": 0
}
```

- `enabledStrings`: cuerdas habilitadas para practicar (1-6). Las deshabilitadas aparecen
  atenuadas en el diapasón y no se usan para generar preguntas.
- `enabledNotes`: notas que pueden pedirse. Para practicar solo naturales usa
  `["C", "D", "E", "F", "G", "A", "B"]`.
- `difficulty`: `1` pide solo la nota (vale cualquier cuerda habilitada), `2` y `3` piden nota +
  cuerda concreta (ej. `(3) G` = nota G en la 3ª cuerda). El `3` además permite que la nota
  aparezca más allá del traste 11, repitiéndose en la misma cuerda una octava después.
- `fretsCount`: cantidad de trastes mostrados (sin contar la cuerda al aire). El diagrama tiene
  scroll horizontal, así que se puede subir hasta 24 (lo típico en una guitarra eléctrica).
- `timePerQuestionSeconds`: `0` no pone límite y solo cronometra cuánto tardas; un valor mayor a
  `0` inicia una cuenta regresiva y da la pregunta por fallada si se agota.
- `soundEnabled`: si suena cada traste al presionarlo (valor inicial; el botón 🔊 dentro del
  juego lo puede alternar y queda guardado en el navegador).

Al presionar un traste suena la nota real (síntesis de cuerda pulsada tipo Karplus-Strong vía
Web Audio API, generada en el navegador — sin muestras de audio ni conexión a internet) afinada
a la altura exacta de esa cuerda y traste. Si fallas, además suena la nota correcta un instante
después para reforzar el oído.

## Banco de escalas

Las respuestas están en:

```text
data/scales.json
```

El archivo incluye escalas mayores naturales, sostenidas y bemoles.

## Estructura

```text
juego-escalas-node/
├── config/
│   └── game-config.json
├── data/
│   └── scales.json
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── package.json
├── server.js
└── README.md
```
