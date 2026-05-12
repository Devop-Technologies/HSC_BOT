const express = require('express');
const router = express.Router();
const faqService = require('../services/faqService');

// Secret middleware
router.use((req, res, next) => {
  const secret = process.env.ADMIN_WEBHOOK_SECRET;
  if (secret && req.headers['x-admin-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// GET all FAQs
router.get('/', async (req, res) => {
  try {
    const faqs = await faqService.getAllFaqs();
    res.json(faqs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single FAQ
router.get('/:id', async (req, res) => {
  try {
    const faq = await faqService.getFaqById(req.params.id);
    if (!faq) return res.status(404).json({ error: 'Not found' });
    res.json(faq);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create FAQ
router.post('/', async (req, res) => {
  try {
    const { question_en, question_ar, answer_en, answer_ar, sort_order } = req.body;
    if (!question_en || !answer_en) {
      return res.status(400).json({ error: 'question_en and answer_en are required' });
    }
    const result = await faqService.createFaq({ question_en, question_ar, answer_en, answer_ar, sort_order });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update FAQ
router.patch('/:id', async (req, res) => {
  try {
    const { question_en, question_ar, answer_en, answer_ar, sort_order, is_active } = req.body;
    const result = await faqService.updateFaq(req.params.id, { question_en, question_ar, answer_en, answer_ar, sort_order, is_active });
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE FAQ
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await faqService.deleteFaq(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
