import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
// Buffer es necesario para trabajar con los datos binarios del stream.
import { Buffer } from 'node:buffer';

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
  } catch (error) {
    console.error(`Error al obtener HTML de ${url}:`, error.message);
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
    // Si no hay 'icy-metaint', la estación no soporta este método.
    if (!metaInt) {
        // console.log(`La estación ${url} no tiene cabecera icy-metaint.`);
        return { title: null, artist: null };
    }

    const reader = res.body.getReader();
    
    // Leemos el primer trozo de datos que contiene la información del tamaño de los metadatos.
    let bytesToRead = metaInt + 256; // Leemos un poco más para asegurar que tenemos los metadatos.
    let receivedLength = 0;
    let chunks = [];
    
    while(receivedLength < bytesToRead) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;
    }

    // Cancelamos la lectura del stream para no descargar la canción entera.
    reader.cancel();

    const buffer = Buffer.concat(chunks);
    
    // El tamaño de los metadatos se encuentra en el byte después del audio.
    const metaLength = buffer[metaInt] * 16;
    if (metaLength === 0) {
        return { title: null, artist: null };
    }

    const metaStart = metaInt + 1;
    const metaEnd = metaStart + metaLength;
    
    const metaData = buffer.slice(metaStart, metaEnd).toString('utf8').replace(/\0/g, "");

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
  } catch (error) {
    console.error(`Error obteniendo ICY metadata de ${url}:`, error.message);
    return { title: null, artist: null };
  }
}

// Endpoint para obtener metadatos de TODAS las estaciones
app.get("/api/metadata-all", async (req, res) => {
  const results = {};

  for (const [name, url] of Object.entries(stations)) {
    let metadata = await getICYMetadata(url);

    // Si no hay título, intentamos desde HTML como alternativa.
    if (!metadata.title) {
      const htmlTitle = await getTitleFromHTML(url);
      if (htmlTitle) {
          metadata.title = htmlTitle;
      }
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
    return res.status(400).json({ error: "Falta el parámetro 'station' o 'url'" });
  }

  let metadata = await getICYMetadata(streamUrl);
  if (!metadata.title) {
    const htmlTitle = await getTitleFromHTML(streamUrl);
    if (htmlTitle) {
        metadata.title = htmlTitle;
    }
  }

  res.json({
    stream: streamUrl,
    ...metadata
  });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
