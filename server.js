import express from "express";
import fetch from "node-fetch";
import icy from "icy";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Lista de estaciones
const stations = {
  flow: "https://stream.zeno.fm/qmhf2yd9dm0uv",
  fhlink: "https://radio.dominiserver.com/proxy/100hitsurbano/stream",
  urbana40: "https://stream.radiocastellon.com/40ur",
  reggaeton: "https://reggaeton.stream.laut.fm/reggaeton"
};

// Función para obtener metadatos ICY con timeout
async function getICYMetadata(url, timeoutMs = 4000) {
  return new Promise((resolve) => {
    let metadata = { artist: null, title: null };
    const timer = setTimeout(() => {
      resolve(metadata);
    }, timeoutMs);

    icy.get(url, (stream) => {
      stream.on("metadata", (meta) => {
        clearTimeout(timer);
        const parsed = icy.parse(meta);
        if (parsed.StreamTitle) {
          const parts = parsed.StreamTitle.split(" - ");
          metadata.artist = parts[0]?.trim() || null;
          metadata.title = parts.slice(1).join(" - ").trim() || null;
        }
        resolve(metadata);
        stream.destroy();
      });

      stream.on("error", () => {
        clearTimeout(timer);
        resolve(metadata);
      });
    });
  });
}

// Endpoint: metadatos de una estación
app.get("/api/metadata", async (req, res) => {
  const { station, url } = req.query;
  const streamUrl = url || stations[station];
  if (!streamUrl) return res.status(400).json({ error: "Falta station o url" });

  const data = await getICYMetadata(streamUrl);
  res.json({ station: station || null, stream: streamUrl, ...data });
});

// Endpoint: todas las estaciones (rápido y ligero)
app.get("/api/metadata/all", async (req, res) => {
  const results = await Promise.all(
    Object.entries(stations).map(async ([name, url]) => {
      const data = await getICYMetadata(url);
      return { station: name, stream: url, ...data };
    })
  );
  res.json(results);
});

// Proxy de audio con CORS
app.get("/api/proxy", async (req, res) => {
  const { station, url } = req.query;
  const streamUrl = url || stations[station];
  if (!streamUrl) return res.status(400).json({ error: "Falta station o url" });

  try {
    const response = await fetch(streamUrl);
    res.setHeader("Content-Type", response.headers.get("content-type"));
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Icy-Metadata");
    response.body.pipe(res);
  } catch (err) {
    res.status(500).json({ error: "Error conectando al stream" });
  }
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
