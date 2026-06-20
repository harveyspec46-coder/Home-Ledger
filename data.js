// Reads and writes one shared JSON blob ("household-data") so every device
// that opens this site sees the same staff schedule and pay log.
//
// Needs a Redis-compatible store connected in the Vercel project
// (Storage tab -> Create Database -> Redis). Vercel sets these env vars
// automatically once it's connected: KV_REST_API_URL, KV_REST_API_TOKEN.

const KEY = "household-data";

export default async function handler(req, res) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return res.status(500).json({
      error: "No database connected yet. In Vercel: Storage tab -> Create Database -> Redis, then redeploy."
    });
  }

  try {
    if (req.method === "GET") {
      const r = await fetch(`${url}/get/${KEY}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      return res.status(200).json({ value: data.result || null });
    }

    if (req.method === "POST") {
      const value = JSON.stringify(req.body);
      await fetch(`${url}/set/${KEY}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: value
      });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
