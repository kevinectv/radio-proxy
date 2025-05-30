const express = require("express");
const request = require("request");
const cors = require("cors");
const axios = require("axios");
const https = require("https");
const qs = require("querystring");

const app = express();
const PORT = process.env.PORT || 3000;

const streamUrl = `https://stream.zeno.fm/${process.env.STATION_ID}`;
const stationId = process.env.STATION_ID;

app.use(cors());

// 🔊 Proxy de audio
app.get("/proxy", (req, res) => {
  request
    .get({
      url: streamUrl,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/113 Safari/537.36"
      }
    })
    .on("error", (err) => {
      console.error("Error al conectar con la radio:", err);
      res.status(500).send("Error de conexión con la radio");
    })
    .pipe(res);
});

// 🔁 EventSource: metadata en tiempo real
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

    zenoRes.on("end", () => res.end());
  });

  client.on("error", (err) => {
    console.error("Error en EventSource desde Zeno:", err.message);
    res.end();
  });

  req.on("close", () => client.destroy());
});

// 🧠 Estado compartido de canción
let currentSong = "";
let spotifyToken = null;
let tokenExpiresAt = 0;

// 🔐 Obtener token de Spotify
async function getSpotifyToken() {
  const now = Date.now();
  if (spotifyToken && tokenExpiresAt > now) return spotifyToken;

  const auth = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    qs.stringify({ grant_type: "client_credentials" }),
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  spotifyToken = response.data.access_token;
  tokenExpiresAt = now + response.data.expires_in * 1000;
  return spotifyToken;
}

// 📡 Escuchar Zeno directamente para guardar el título actual
const metadataUrl = `https://api.zeno.fm/mounts/metadata/subscribe/${stationId}`;
https.get(metadataUrl, (stream) => {
  stream.on("data", (chunk) => {
    const text = chunk.toString();
    try {
      const parsed = JSON.parse(text);
      if (parsed.nowPlaying && parsed.nowPlaying.title) {
        currentSong = parsed.nowPlaying.title;
        console.log("🎵 Canción actual:", currentSong);
      }
    } catch (_) {}
  });
});

// 🎧 Ruta /spotify que busca info automáticamente
app.get("/spotify", async (req, res) => {
  try {
    if (!currentSong) {
      return res.status(400).json({ error: "No se ha detectado canción aún" });
    }

    const token = await getSpotifyToken();

    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(currentSong)}&type=track&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const track = response.data.tracks.items[0];

    if (!track) {
      return res.json({ title: currentSong, error: "No se encontró en Spotify" });
    }

    res.json({
      title: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      image: track.album.images[0]?.url || null
    });
  } catch (error) {
    console.error("Error en /spotify:", error.message);
    res.status(500).json({ error: "Error al buscar en Spotify" });
  }
});

// 🌐 Ruta principal
app.get("/", (req, res) => {
  res.send("Servidor activo con Proxy, Realtime y Spotify 🔥");
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
