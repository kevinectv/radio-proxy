const express = require("express");
const request = require("request");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get("/proxy", (req, res) => {
  const streamUrl = "https://stream.zeno.fm/gutxnkuaz38uv";

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

app.get("/", (_, res) => {
  res.send("Proxy activo");
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
