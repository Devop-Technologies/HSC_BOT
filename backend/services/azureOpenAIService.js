const https = require('https');
const { AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, AZURE_OPENAI_DEPLOYMENT } = require('../config');

/**
 * Send a prompt to Azure OpenAI Chat Completions API and get a response.
 * Uses native https module (no axios/node-fetch per project rules).
 *
 * @param {string} systemPrompt - The system prompt for Sarah's persona
 * @param {string} userMessage  - The customer's message
 * @param {number} timeoutMs    - Request timeout in ms (default 30000)
 * @returns {Promise<string>}   - Azure OpenAI's reply text
 */
async function getAzureReply(systemPrompt, userMessage, timeoutMs = 30000) {
  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_KEY) {
    throw new Error('AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_KEY not set');
  }

  const hostname = AZURE_OPENAI_ENDPOINT.replace(/^https?:\/\//, '').replace(/\/api$/, '').replace(/\/$/, '');
  const path = `/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-02-15-preview`;

  const body = JSON.stringify({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 300,
    temperature: 0.7,
  });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error('Azure OpenAI request timed out'));
    }, timeoutMs);

    const req = https.request(
      {
        hostname,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_OPENAI_KEY,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          clearTimeout(timer);
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              return reject(new Error(`Azure OpenAI API error: ${parsed.error.message}`));
            }
            const text = parsed.choices?.[0]?.message?.content;
            if (!text) return reject(new Error('Empty response from Azure OpenAI'));
            resolve(text.trim());
          } catch (e) {
            reject(new Error(`Failed to parse Azure OpenAI response: ${e.message}`));
          }
        });
      }
    );

    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

module.exports = { getAzureReply };
