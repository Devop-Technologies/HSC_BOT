const express = require('express');
const router = express.Router();
const healthRecService = require('../services/healthRecommendationService');

// Secret middleware
router.use((req, res, next) => {
  const secret = process.env.ADMIN_WEBHOOK_SECRET;
  if (secret && req.headers['x-admin-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// GET all recommendations
router.get('/', async (req, res) => {
  try {
    const recs = await healthRecService.getAllRecommendations();
    res.json(recs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single recommendation
router.get('/:id', async (req, res) => {
  try {
    const rec = await healthRecService.getRecommendationById(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Not found' });
    res.json(rec);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create recommendation
router.post('/', async (req, res) => {
  try {
    const { keywords, keywords_ar, service_ids, why_en, why_ar, warning_en, warning_ar, sort_order } = req.body;
    if (!keywords || !keywords.length || !service_ids || !service_ids.length || !why_en) {
      return res.status(400).json({ error: 'keywords, service_ids, and why_en are required' });
    }
    const result = await healthRecService.createRecommendation({ keywords, keywords_ar, service_ids, why_en, why_ar, warning_en, warning_ar, sort_order });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update recommendation
router.patch('/:id', async (req, res) => {
  try {
    const { keywords, keywords_ar, service_ids, why_en, why_ar, warning_en, warning_ar, sort_order, is_active } = req.body;
    const result = await healthRecService.updateRecommendation(req.params.id, { keywords, keywords_ar, service_ids, why_en, why_ar, warning_en, warning_ar, sort_order, is_active });
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE recommendation
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await healthRecService.deleteRecommendation(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
