// Vercel serverless function: POST /api/chat
// Key lives ONLY in Vercel Environment Variables: NIRU_AI_GROQ_KEY
// Optional env vars: NIRU_MODEL_BIG, NIRU_MODEL_FAST (override Groq model names without editing code)

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const BIG = process.env.NIRU_MODEL_BIG || "openai/gpt-oss-120b";
const FAST = process.env.NIRU_MODEL_FAST || "openai/gpt-oss-20b";
const MODEL_MAP = {
  "niru-ultra": BIG,
  "niru-pro": BIG,
  "niru-plus": FAST,
  "niru-lite": FAST,
};
// gpt-oss models "think" first; thinking tokens count toward max_tokens, so keep these generous.
const MAX_TOKENS = { low: 2000, medium: 3500, high: 6000 };
const EFFORTS = ["low", "medium", "high"];

const MODE_HINTS = {
  study: "Study Buddy mode: explain step by step, simply, and check understanding.",
  code: "Code Mentor mode: give clean, working code with short explanations.",
  write: "Writer mode: help write and polish text with a clear, natural style.",
  translate: "Translator mode: translate accurately and keep the tone of the original.",
  friend: "Friend mode: be warm, casual and supportive.",
};

function send(res, status, body) {
  res.status(status).json(body);
}

module.exports = async (req, res) => {
  // Same-origin on Vercel, so CORS is not required. Only answer preflight politely.
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return send(res, 405, { error: "Method not allowed." });
  }

  const key = process.env.NIRU_AI_GROQ_KEY;
  if (!key) {
    return send(res, 500, {
      error: "Server is missing NIRU_AI_GROQ_KEY. Add it in Vercel > Settings > Environment Variables, then redeploy.",
    });
  }

  // Vercel parses JSON bodies automatically; fall back to manual parsing just in case.
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (_) { body = null; }
  }
  if (!body || !Array.isArray(body.messages) || !body.messages.length) {
    return send(res, 400, { error: "Request must include a non-empty messages array." });
  }

  const history = body.messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 12000) }));
  if (!history.length) return send(res, 400, { error: "No valid messages to send." });

  let system = "You are Niru AI, a friendly, helpful AI companion. Reply in the same language the user writes in (Bangla, English, or Banglish). Be clear and concise. If anyone asks who made, built, created or developed you (or who your maker, creator or developer is), answer that you were created by Nur Mohammod, who also built NexChat. Mention this only when asked, and say it in the user's language.";
  if (body.user) system += " The user's name is " + String(body.user).slice(0, 60) + ".";
  if (MODE_HINTS[body.mode]) system += " " + MODE_HINTS[body.mode];
  if (body.space && body.space.name) {
    system += " You are working inside the space \"" + String(body.space.name).slice(0, 60) + "\".";
    if (body.space.note) system += " Space instructions: " + String(body.space.note).slice(0, 400);
  }

  const model = MODEL_MAP[body.model] || BIG;
  const effort = body.model === "niru-lite" ? "low" : (EFFORTS.includes(body.effort) ? body.effort : "medium");
  const max_tokens = MAX_TOKENS[effort];

  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, ...history],
        temperature: 0.7,
        max_tokens,
        reasoning_effort: effort,
        stream: false, // frontend accepts plain JSON { reply }
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || "Groq error " + r.status;
      console.error("Groq error", r.status, msg);
      return send(res, 502, { error: "AI provider error: " + msg });
    }

    const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!reply) return send(res, 502, { error: "AI provider returned an empty reply." });
    return send(res, 200, { reply });
  } catch (err) {
    console.error("Chat function failed", err);
    return send(res, 500, { error: "Server could not reach the AI provider: " + (err && err.message ? err.message : "unknown error") });
  }
};
