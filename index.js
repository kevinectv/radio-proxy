import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send("Missing stream URL");
  }

  try {
    const streamRes = await fetch(url);

    if (!streamRes.ok || !streamRes.body) {
      return res.status(500).send("Failed to fetch stream");
    }

    res.set({
      "Content-Type": streamRes.headers.get("content-type") || "audio/mpeg",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
      "Access-Control-Allow-Origin": "*",
      "Connection": "keep-alive",
    });

    streamRes.body.pipe(res);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Error fetching stream");
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
