const express = require("express");
const request = require("request");
const cors = require("cors");
const axios = require("axios");
const https = require("https"); // Para EventSource
const http = require("http");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const streamUrl = "https://stream.zeno.fm/qmhf2yd9dm0uv";
const stationId = "qmhf2yd9dm0uv";

// ✅ Ruta de proxy de audio
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

// ✅ Ruta de metadatos estáticos (si no querés tiempo real)
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

// ✅ Ruta en tiempo real (EventSource proxy a Zeno)
app.get("/realtime", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });

  const sourceUrl = `https://api.zeno.fm/mounts/metadata/subscribe/${stationId}`;

  const client = https.get(sourceUrl, (zenoRes) => {
    zenoRes.on("data", (chunk) => {
      res.write(`data: ${chunk.toString().trim()}\n\n`);
    });

    zenoRes.on("end", () => {
      res.end();
    });
  });

  client.on("error", (err) => {
    console.error("Error en EventSource desde Zeno:", err.message);
    res.end();
  });

  req.on("close", () => {
    client.destroy();
  });
});

// ✅ Ruta raíz
app.get("/", (req, res) => {
  res.send("Proxy y Metadata activos 🚀");
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
