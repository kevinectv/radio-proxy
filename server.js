const express = require("express");
const request = require("request");
const cors = require("cors");
const icy = require("icy");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const streamUrl = "https://stream.zeno.fm/qmhf2yd9dm0uv"; // tu URL real de radio

// Ruta de proxy de audio
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

// Ruta para obtener metadata
app.get("/metadata", (req, res) => {
  icy.get(streamUrl, (icyRes) => {
    icyRes.on("metadata", (metadata) => {
      const parsed = icy.parse(metadata);
      const title = parsed.StreamTitle || "Desconocido";
      res.json({ title });
    });

    icyRes.on("error", (err) => {
      console.error("Error leyendo metadata:", err);
      res.status(500).json({ error: "No se pudo obtener metadata" });
    });
  });
});

app.get("/", (req, res) => {
  res.send("Proxy y Metadata activos 🚀");
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
