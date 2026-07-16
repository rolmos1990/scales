const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG_PATH = path.join(__dirname, "config", "game-config.json");
const SCALES_PATH = path.join(__dirname, "data", "scales.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

app.get("/api/game-data", (req, res) => {
  try {
    const config = readJson(CONFIG_PATH);
    const scales = readJson(SCALES_PATH);

    const selectedScales = config.enabledScales
      .map((scaleName) => scales[scaleName])
      .filter(Boolean);

    res.json({
      config,
      scales: selectedScales,
      availableScales: Object.keys(scales)
    });
  } catch (error) {
    console.error("Error cargando la configuración:", error);
    res.status(500).json({
      error: "No fue posible cargar la configuración del juego."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Juego disponible en http://localhost:${PORT}`);
});
