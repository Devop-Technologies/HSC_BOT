require('dotenv').config();

module.exports = {
  WAHA_API_URL:       process.env.WAHA_API_URL       || 'http://localhost:3000',
  WAHA_API_KEY:       process.env.WAHA_API_KEY       || 'your-secret-key',
  OLLAMA_URL:         process.env.OLLAMA_URL         || 'http://localhost:11434',
  OLLAMA_MODEL:       process.env.OLLAMA_MODEL       || 'qwen2.5:7b',
  SESSION:            process.env.SESSION            || 'default',
  PORT:               process.env.PORT               || 5000,
  AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT || '',
  AZURE_OPENAI_KEY:   process.env.AZURE_OPENAI_KEY   || '',
  AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini',
};
