import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
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
    if (!metaInt) {
        return { title: null, artist: null };
    }

    const reader = res.body.getReader();
    let bytesToRead = metaInt + 256;
    let receivedLength = 0;
    let chunks = [];
    
    while(receivedLength < bytesToRead) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;
    }

    reader.cancel();
    const buffer = Buffer.concat(chunks);
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

// --- CÓDIGO ACTUALIZADO ---
// Endpoint MEJORADO para obtener metadatos de TODAS las estaciones en paralelo
app.get("/api/metadata-all", async (req, res) => {
  try {
    // 1. Creamos un array de promesas, una para cada estación.
    const promises = Object.entries(stations).map(async ([name, url]) => {
      let metadata = await getICYMetadata(url);

      if (!metadata.title) {
        const htmlTitle = await getTitleFromHTML(url);
        if (htmlTitle) {
          metadata.title = htmlTitle;
        }
      }

      // Devolvemos un objeto con el nombre para poder reconstruir el resultado final.
      return { 
        name, 
        data: {
          stream: url,
          ...metadata
        }
      };
    });

    // 2. Esperamos a que TODAS las promesas se completen.
    const stationResults = await Promise.all(promises);

    // 3. Convertimos el array de resultados en el objeto JSON final.
    const results = stationResults.reduce((acc, result) => {
      acc[result.name] = result.data;
      return acc;
    }, {});

    res.json(results);
  } catch (error) {
    console.error("Error en /api/metadata-all:", error);
    res.status(500).json({ error: "No se pudieron obtener los metadatos de todas las estaciones." });
  }
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

// --- RUTA AÑADIDA ---
// Ruta para la página principal (/) para evitar el "Cannot GET /"
app.get("/", (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <body style="font-family: sans-serif; background-color: #f0f0f0; padding: 2em;">
      <h1>API de Metadatos de Radio</h1>
      <p>¡Bienvenido! El servidor está funcionando correctamente.</p>
      <h3>Endpoints disponibles:</h3>
      <ul>
        <li><a href="/api/metadata-all">/api/metadata-all</a> (Obtiene los metadatos de todas las estaciones)</li>
        <li><a href="/api/metadata?station=fhlink">/api/metadata?station=fhlink</a> (Obtiene metadatos de una estación específica)</li>
      </ul>
    </body>
  `);
});


app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
