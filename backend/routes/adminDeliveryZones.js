const express = require('express');
const router = express.Router();
const deliveryZoneService = require('../services/deliveryZoneService');

// Secret middleware
router.use((req, res, next) => {
  const secret = process.env.ADMIN_WEBHOOK_SECRET;
  if (secret && req.headers['x-admin-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// GET all delivery tariff bands (kept under /delivery-zones for admin UI compatibility)
router.get('/', async (req, res) => {
  try {
    const zones = await deliveryZoneService.getAllZones();
    res.json(zones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single zone
router.get('/:id', async (req, res) => {
  try {
    const zone = await deliveryZoneService.getZoneById(req.params.id);
    if (!zone) return res.status(404).json({ error: 'Not found' });
    res.json(zone);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create zone
router.post('/', async (req, res) => {
  try {
    const { label, district, min_km, base_fee, fee_per_km, max_km, sort_order, is_active } = req.body;
    if (!(label || district)) return res.status(400).json({ error: 'label is required' });
    const result = await deliveryZoneService.createZone({ label, district, min_km, base_fee, fee_per_km, max_km, sort_order, is_active });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update zone
router.patch('/:id', async (req, res) => {
  try {
    const { label, district, min_km, base_fee, fee_per_km, max_km, sort_order, is_active } = req.body;
    const result = await deliveryZoneService.updateZone(req.params.id, { label, district, min_km, base_fee, fee_per_km, max_km, sort_order, is_active });
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE zone
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await deliveryZoneService.deleteZone(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
