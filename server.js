const express = require("express");
const request = require("request");
const cors = require("cors");
const axios = require("axios"); // 🔥 Agregado
// const icy = require("icy"); // ❌ Ya no lo vamos a usar

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const streamUrl = "https://stream.zeno.fm/qmhf2yd9dm0uv"; // tu URL real de radio
const stationId = "qmhf2yd9dm0uv"; // el ID exacto de tu estación

// Ruta de proxy de audio (esto queda igual)
app.get("/proxy", (req, res) => {
  const options = {
    url: streamUrl,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/113 Safari/537.36"
    }
  };

  request
    .get(options)
    .on("error", (err) => {
      console.error("Error al conectar con la radio:", err);
      res.status(500).send("Error de conexión con la radio");
    })
    .pipe(res);
});

// Ruta para obtener metadata desde la API de Zeno.fm ✅
app.get("/metadata", async (req, res) => {
  try {
    const response = await axios.get(`https://api.zeno.fm/station/stream/${stationId}.json`);
    const nowPlaying = response.data?.now_playing?.song || "Desconocido";
    res.json({ title: nowPlaying });
  } catch (error) {
    console.error("Error al obtener metadata:", error.message);
    res.status(500).json({ error: "No se pudo obtener metadata" });
  }
});

// Ruta base
app.get("/", (req, res) => {
  res.send("Proxy y Metadata activos 🚀");
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
