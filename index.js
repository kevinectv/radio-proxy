import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

app.get("/stream", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("Missing stream URL");

  try {
    const response = await fetch(url);
    if (!response.body) return res.status(500).send("No stream found");

    res.setHeader("Content-Type", response.headers.get("Content-Type") || "audio/mpeg");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");

    response.body.pipe(res);
  } catch (err) {
    console.error("Stream error:", err);
    res.status(500).send("Stream failed");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
