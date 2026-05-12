const { OLLAMA_URL, OLLAMA_MODEL } = require('../config');

async function getOllamaReply(prompt, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: {
          num_ctx: 4096,
          num_predict: 200,
          temperature: 0.7,
          top_k: 40,
          top_p: 0.9,
          repeat_penalty: 1.1,
        },
      }),
    });
    const data = await res.json();
    return data.response;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { getOllamaReply };
