const express = require('express');
const router = express.Router();
const { getActiveSystemPrompt, updateSystemPrompt, getLatestSystemPrompt, clearSystemPromptCache } = require('../services/systemPromptService');

// Secret middleware
router.use((req, res, next) => {
  const secret = process.env.ADMIN_WEBHOOK_SECRET;
  if (secret && req.headers['x-admin-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// GET the current system prompt
router.get('/', async (req, res) => {
  try {
    const prompt = await getLatestSystemPrompt();
    if (prompt) {
      res.json(prompt);
    } else {
      // Fall back to the hardcoded one
      const { getSystemPrompt } = require('../data/planText');
      res.json({
        id: null,
        prompt_text: getSystemPrompt([], [], []),
        updated_at: null,
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH - update the system prompt
router.patch('/', async (req, res) => {
  try {
    const { prompt_text } = req.body;
    if (!prompt_text || prompt_text.trim().length < 10) {
      return res.status(400).json({ error: 'prompt_text is required (min 10 chars)' });
    }
    const result = await updateSystemPrompt(prompt_text.trim());
    // Clear bot's cache so it picks up the new prompt on next message
    clearSystemPromptCache();
    console.log('[SYSTEM_PROMPT] Updated by admin. Cache cleared.');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
