const express = require("express");
const cors = require("cors");
const axios = require("axios");
const https = require("https");
const qs = require("querystring");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// 🧠 Estado compartido por estación
const currentSongs = {};
let spotifyToken = null;
let tokenExpiresAt = 0;

// 📡 Metadatos Zeno por ID (tiempo real)
app.get("/realtime", (req, res) => {
  const stationId = req.query.id;
  if (!stationId) return res.status(400).send("Falta parámetro ?id");

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const sourceUrl = `https://api.zeno.fm/mounts/metadata/subscribe/${stationId}`;
  const client = https.get(sourceUrl, (zenoRes) => {
    let buffer = "";

    zenoRes.on("data", (chunk) => {
      buffer += chunk.toString();
      const events = buffer.split("\n\n");
      buffer = events.pop();

      for (const eventBlock of events) {
        if (eventBlock.includes("streamTitle")) {
          const dataLine = eventBlock
            .split("\n")
            .find((line) => line.startsWith("data:"));
          if (dataLine) {
            try {
              const parsed = JSON.parse(dataLine.replace("data:", "").trim());
              const title = parsed?.streamTitle;

              if (title && currentSongs[stationId] !== title) {
                currentSongs[stationId] = title;
                console.log(`🎵 [${stationId}] Nueva canción: ${title}`);
              }

              res.write(`data: ${JSON.stringify(parsed)}\n\n`);
            } catch (err) {
              console.error("❌ Error al parsear JSON:", err.message);
            }
          }
        }
      }
    });

    zenoRes.on("end", () => res.end());
  });

  client.on("error", (err) => {
    console.error("❌ Error EventSource Zeno:", err.message);
    res.end();
  });

  req.on("close", () => client.destroy());
});

// 🔐 Token de Spotify
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
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  spotifyToken = response.data.access_token;
  tokenExpiresAt = now + response.data.expires_in * 1000;
  return spotifyToken;
}

// 🎧 Buscar info de Spotify
app.get("/spotify", async (req, res) => {
  const stationId = req.query.id;
  if (!stationId) return res.status(400).json({ error: "Falta ?id" });

  const currentSong = currentSongs[stationId];
  if (!currentSong) {
    return res.status(400).json({ error: "No se ha detectado canción aún" });
  }

  try {
    const token = await getSpotifyToken();

    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        currentSong
      )}&type=track&limit=1`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const track = response.data.tracks.items[0];

    if (!track) {
      return res.json({ title: currentSong, error: "No se encontró en Spotify" });
    }

    res.json({
      title: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      image: track.album.images[0]?.url || null,
    });
  } catch (error) {
    console.error("❌ Error /spotify:", error.message);
    res.status(500).json({ error: "Error al buscar en Spotify" });
  }
});

// 🖼️ Proxy imagen
app.get("/proxy-image", async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) return res.status(400).send("Falta el parámetro 'url'");

  try {
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });

    const contentType = response.headers["content-type"] || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.send(response.data);
  } catch (error) {
    console.error("❌ Error al cargar imagen:", error.message);
    res.status(500).send("Error al cargar imagen");
  }
});

// 🌐 Ruta raíz
app.get("/", (req, res) => {
  res.send("✅ Servidor listo: Zeno + Spotify + imágenes");
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
