export default async function handler(req, res) {
    const { endpoint } = req.query;
  
    try {
      const flaskResponse = await fetch(`http://127.0.0.1:5000/api/${endpoint}`, {
        method: req.method,
        headers: {
          "Content-Type": "application/json",
        },
        body: req.method === "POST" ? JSON.stringify(req.body) : null,
      });
  
      const data = await flaskResponse.json();
      res.status(flaskResponse.status).json(data);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
}