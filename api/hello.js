// Serverless routing verification endpoint
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    message: "Hello from serverless function",
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  });
}
