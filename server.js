// server.js
import express from "express";
import fetch from "node-fetch";
import icy from "icy";

const app = express();
const PORT = process.env.PORT || 3000;

// Lista de estaciones
const stations = {
  flow: "https://stream.zeno.fm/qmhf2yd9dm0uv",
  fhlink: "https://radio.dominiserver.com/proxy/100hitsurbano/stream",
  urbana40: "https://stream.radiocastellon.com/40ur",
  reggaeton: "https://reggaeton.stream.laut.fm/reggaeton",
};

// Función para obtener metadatos ICY manualmente
async function getMetadata(streamUrl) {
  const resp = await fetch(streamUrl, {
    method: "GET",
    headers: {
      "Icy-MetaData": "1",
      "User-Agent": "Mozilla/5.0",
    },
  });

  const metaInt = parseInt(resp.headers.get("icy-metaint"));
  if (!metaInt) {
    return { error: "No ICY metadata" };
  }

  const reader = resp.body.getReader();
  let bytesRead = 0;
  let buffers = [];

  while (bytesRead < metaInt + 1) {
    const { done, value } = await reader.read();
    if (done) break;
    buffers.push(value);
    bytesRead += value.length;
  }

  const buffer = Buffer.concat(buffers);
  const metaLength = buffer[metaInt] * 16;

  if (metaLength === 0) {
    return { title: null, artist: null };
  }

  let needed = metaInt + 1 + metaLength;
  let finalBuffer = buffer;

  while (finalBuffer.length < needed) {
    const { done, value } = await reader.read();
    if (done) break;
    finalBuffer = Buffer.concat([finalBuffer, Buffer.from(value)]);
  }

  const metaData = finalBuffer
    .slice(metaInt + 1, metaInt + 1 + metaLength)
    .toString("utf8")
    .replace(/\0/g, "");

  const match = metaData.match(/StreamTitle='([^']*)';/);
  const rawTitle = match ? match[1] : null;

  let artist = null;
  let title = null;
  if (rawTitle) {
    const parts = rawTitle.split(" - ");
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts.slice(1).join(" - ").trim();
    } else {
      title = rawTitle.trim();
    }
  }

  return { title, artist, raw: rawTitle };
}

// 📌 Endpoint para pedir metadatos
app.get("/api/metadata", async (req, res) => {
  const { station, url } = req.query;
  const streamUrl = url || stations[station];

  if (!streamUrl) {
    return res.status(400).json({ error: "Falta station o url" });
  }

  try {
    let metadata = await getMetadata(streamUrl);

    // Si no hay metadatos, intentamos con icy como fallback
    if (!metadata.raw) {
      await new Promise((resolve) => {
        icy.get(streamUrl, (stream) => {
          stream.on("metadata", (meta) => {
            const parsed = icy.parse(meta);
            metadata = { title: parsed.StreamTitle || null };
            resolve();
            stream.destroy();
          });
          stream.on("error", () => resolve());
        });
      });
    }

    res.json(metadata);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo metadatos", details: err.message });
  }
});

// 📌 Endpoint proxy para reproducir el stream sin CORS
app.get("/api/proxy", async (req, res) => {
  const { station, url } = req.query;
  const streamUrl = url || stations[station];

  if (!streamUrl) {
    return res.status(400).json({ error: "Falta station o url" });
  }

  try {
    const response = await fetch(streamUrl);
    res.setHeader("Content-Type", response.headers.get("content-type"));
    response.body.pipe(res);
  } catch (error) {
    console.error("Error en proxy:", error);
    res.status(500).json({ error: "No se pudo conectar al stream" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
