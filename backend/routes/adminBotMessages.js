const express = require('express');
const router = express.Router();
const botMessagesService = require('../services/botMessagesService');

// Secret middleware
router.use((req, res, next) => {
  const secret = process.env.ADMIN_WEBHOOK_SECRET;
  if (secret && req.headers['x-admin-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// GET all bot messages
router.get('/', async (req, res) => {
  try {
    const messages = await botMessagesService.getAllMessages();
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - create or update a message
router.post('/', async (req, res) => {
  try {
    const { key, message_en, message_ar } = req.body;
    if (!key || !message_en) {
      return res.status(400).json({ error: 'key and message_en are required' });
    }
    const result = await botMessagesService.upsertMessage(key, message_en, message_ar || '');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH - update a message (alias for POST)
router.patch('/:key', async (req, res) => {
  try {
    const key = req.params.key || req.body.key;
    const { message_en, message_ar } = req.body;
    if (!key || !message_en) {
      return res.status(400).json({ error: 'key and message_en are required' });
    }
    const result = await botMessagesService.upsertMessage(key, message_en, message_ar || '');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a message
router.delete('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const deleted = await botMessagesService.deleteMessage(key);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
