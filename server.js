const express = require("express");
const request = require("request");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get("/proxy", (req, res) => {
  const streamUrl = "https://stream.zeno.fm/gutxnkuaz38uv"; // Cambia esta URL si querés otra
  request
    .get(streamUrl)
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