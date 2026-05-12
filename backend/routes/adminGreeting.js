const express = require('express');
const router = express.Router();
const greetingService = require('../services/greetingService');

// Secret middleware
router.use((req, res, next) => {
  const secret = process.env.ADMIN_WEBHOOK_SECRET;
  if (secret && req.headers['x-admin-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// GET all greetings
router.get('/', async (req, res) => {
  try {
    const greetings = await greetingService.getAllGreetings();
    res.json(greetings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new greeting
router.post('/', async (req, res) => {
  try {
    const { message_en, message_ar } = req.body;
    if (!message_en || !message_ar) return res.status(400).json({ error: 'message_en and message_ar required' });
    const newGreeting = await greetingService.addGreeting(message_en, message_ar);
    res.json(newGreeting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update greeting
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { message_en, message_ar, is_active } = req.body;
    if (!message_en || !message_ar) return res.status(400).json({ error: 'message_en and message_ar required' });
    const updated = await greetingService.updateGreeting(id, message_en, message_ar, is_active);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE greeting
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await greetingService.deleteGreeting(id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
