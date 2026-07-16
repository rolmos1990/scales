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
