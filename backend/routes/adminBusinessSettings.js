const express = require('express');
const router = express.Router();
const businessSettingsService = require('../services/businessSettingsService');

// Secret middleware
router.use((req, res, next) => {
  const secret = process.env.ADMIN_WEBHOOK_SECRET;
  if (secret && req.headers['x-admin-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// GET all settings
router.get('/', async (req, res) => {
  try {
    const settings = await businessSettingsService.getAllSettings();
    // Convert to key-value map for convenience
    const map = {};
    settings.forEach(s => { map[s.key] = s; });
    res.json({ rows: settings, map });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single setting
router.get('/:key', async (req, res) => {
  try {
    const setting = await businessSettingsService.getSetting(req.params.key);
    if (!setting) return res.status(404).json({ error: 'Not found' });
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - create or update a setting
router.post('/', async (req, res) => {
  try {
    const { key, value, value_ar, description } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'key and value are required' });
    }
    const result = await businessSettingsService.upsertSetting(key, String(value), value_ar, description);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH - update a setting
router.patch('/:key', async (req, res) => {
  try {
    const { value, value_ar, description } = req.body;
    const result = await businessSettingsService.upsertSetting(req.params.key, String(value), value_ar, description);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a setting
router.delete('/:key', async (req, res) => {
  try {
    const deleted = await businessSettingsService.deleteSetting(req.params.key);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
