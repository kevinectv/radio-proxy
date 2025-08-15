import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000;

// Lista de estaciones
const stations = {
  flow: "https://stream.zeno.fm/qmhf2yd9dm0uv",
  fhlink: "https://radio.dominiserver.com/proxy/100hitsurbano/stream",
  urbana40: "https://stream.radiocastellon.com/40ur",
  reggaeton: "https://reggaeton.stream.laut.fm/reggaeton",
};

// Función para obtener título desde metadatos HTML (cuando aplica)
async function getTitleFromHTML(url) {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);
    return $("title").text() || null;
  } catch {
    return null;
  }
}

// Función para obtener ICY metadata
async function getICYMetadata(url) {
  try {
    const res = await fetch(url, {
      headers: { "Icy-MetaData": "1", "User-Agent": "Mozilla/5.0" }
    });

    const metaInt = parseInt(res.headers.get("icy-metaint"));
    if (!metaInt) return { title: null, artist: null };

    const reader = res.body.getReader();
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
    if (metaLength === 0) return { title: null, artist: null };

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
  } catch {
    return { title: null, artist: null };
  }
}

// Endpoint para obtener metadatos de TODAS las estaciones
app.get("/api/metadata-all", async (req, res) => {
  const results = {};

  for (const [name, url] of Object.entries(stations)) {
    let metadata = await getICYMetadata(url);

    // Si no hay título, intentamos desde HTML
    if (!metadata.title) {
      const htmlTitle = await getTitleFromHTML(url);
      metadata.title = htmlTitle;
    }

    results[name] = {
      stream: url,
      ...metadata
    };
  }

  res.json(results);
});

// Endpoint para obtener metadatos de UNA sola estación
app.get("/api/metadata", async (req, res) => {
  const { station, url } = req.query;
  const streamUrl = url || stations[station];

  if (!streamUrl) {
    return res.status(400).json({ error: "Falta station o url" });
  }

  let metadata = await getICYMetadata(streamUrl);
  if (!metadata.title) {
    const htmlTitle = await getTitleFromHTML(streamUrl);
    metadata.title = htmlTitle;
  }

  res.json({
    stream: streamUrl,
    ...metadata
  });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
