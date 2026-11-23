
module.exports = async (req, res) => {
  const allowedOrigin =
    "https://nurmohammod5619-cpu.github.io";

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.NIRU_AI_GROQ_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Niru AI API key is missing."
    });
  }

  try {
    const incoming = req.body?.messages;

    if (!Array.isArray(incoming)) {
      return res.status(400).json({
        error: "Invalid messages."
      });
    }

    const messages = incoming
      .filter(m =>
        ["user", "assistant"].includes(m.role) &&
        typeof m.content === "string"
      )
      .slice(-20)
      .map(m => ({
        role: m.role,
        content: m.content
      }));

    if (!messages.length) {
      return res.status(400).json({
        error: "No valid messages."
      });
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages,
          max_completion_tokens: 2048
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API error:", data);
      return res.status(502).json({
        error: "Niru AI could not get a response from Groq."
      });
    }

    const reply =
      data.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(502).json({
        error: "Empty AI response."
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Niru server error:", error);

    return res.status(500).json({
      error: "Niru AI server error."
    });
  }
};
