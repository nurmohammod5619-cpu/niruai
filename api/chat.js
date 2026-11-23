
module.exports = async (req, res) => {
  const allowedOrigin = "https://niruai.vercel.app";

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  const apiKey = process.env.NIRU_AI_GROQ_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Niru AI API key is missing."
    });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;

    const incoming = body?.messages;

    if (!Array.isArray(incoming)) {
      return res.status(400).json({
        error: "Invalid messages."
      });
    }

    const systemPrompt = `
তোমার নাম Niru। তুমি Niru AI, একটি ব্যক্তিগত AI assistant।

তোমার নির্মাতা Nur Mohammod।
তিনি NexChat App-এরও নির্মাতা।

পরিচয় সংক্রান্ত নিয়ম:

১. কেউ তোমার নাম জিজ্ঞেস করলে বলবে:
"আমার নাম Niru।"

২. কেউ তোমার নির্মাতা সম্পর্কে জিজ্ঞেস করলে বলবে:
"আমাকে বানিয়েছেন Nur Mohammod, যিনি কিনা NexChat App-ও বানিয়েছেন।"

৩. কেউ তোমার পরিচয় জানতে চাইলে বলবে:
"আমি Niru AI। আমাকে তৈরি করেছেন Nur Mohammod।"

৪. কখনো নিজেকে ChatGPT বা OpenAI-এর ChatGPT বলে পরিচয় দেবে না।

৫. Groq তোমার AI response তৈরি করার প্রযুক্তি।
কিন্তু Groq-কে তোমার নাম বা নির্মাতা বলবে না।

৬. ব্যবহারকারীর প্রশ্নের উত্তর সঠিক, পরিষ্কার ও সহায়কভাবে দেবে।

৭. ব্যবহারকারী বাংলায় কথা বললে বাংলায় উত্তর দেবে।
ইংরেজিতে কথা বললে ইংরেজিতে উত্তর দেবে।

৮. নিজের পরিচয় সম্পর্কে প্রশ্নের ক্ষেত্রে এই নির্দেশনাগুলো অনুসরণ করবে।
`;

    const messages = incoming
      .filter(
        (m) =>
          ["user", "assistant"].includes(m?.role) &&
          typeof m.content === "string"
      )
      .slice(-20)
      .map((m) => ({
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
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            ...messages
          ],
          temperature: 0.7,
          max_tokens: 2048
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

    const reply = data?.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(502).json({
        error: "Empty AI response."
      });
    }

    return res.status(200).json({
      reply: reply
    });

  } catch (error) {
    console.error("Niru server error:", error);

    return res.status(500).json({
      error: "Niru AI server error."
    });
  }
};
