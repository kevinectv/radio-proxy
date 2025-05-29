const express = require("express");
const request = require("request");
const cors = require("cors");
const axios = require("axios");
const https = require("https");
const qs = require("querystring");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const streamUrl = "https://stream.zeno.fm/qmhf2yd9dm0uv";
const stationId = "qmhf2yd9dm0uv";

// 🔊 Proxy de audio
app.get("/proxy", (req, res) => {
  const options = {
    url: streamUrl,
    headers: {
      "User-Agent": "Mozilla/5.0"
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

// 📻 Metadata estática desde Zeno
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

// 📡 Real-time streaming desde Zeno
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
    console.error("Error en realtime Zeno:", err.message);
    res.end();
  });

  req.on("close", () => {
    client.destroy();
  });
});

// 🖼️ NUEVO: Carátula de Spotify
app.get("/spotify", async (req, res) => {
  const song = req.query.song;
  if (!song) return res.status(400).json({ error: "Falta el parámetro 'song'" });

  try {
    // 1. Obtener token de acceso
    const tokenRes = await axios.post(
      "https://accounts.spotify.com/api/token",
      qs.stringify({ grant_type: "client_credentials" }),
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    const token = tokenRes.data.access_token;

    // 2. Buscar la canción
    const searchRes = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(song)}&type=track&limit=1`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    const item = searchRes.data.tracks.items[0];
    if (!item) return res.status(404).json({ error: "Canción no encontrada" });

    res.json({
      title: item.name,
      artist: item.artists.map((a) => a.name).join(", "),
      image: item.album.images[0]?.url || null
    });
  } catch (err) {
    console.error("Error al buscar en Spotify:", err.message);
    res.status(500).json({ error: "No se pudo obtener datos de Spotify" });
  }
});

// 🌐 Ruta raíz
app.get("/", (req, res) => {
  res.send("Proxy, Metadata, y Spotify activos 🚀");
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
