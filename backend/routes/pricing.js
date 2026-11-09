const express = require('express');
const { query, queryOne, run } = require('../config/db');
const { calculatePricingEstimate } = require('../utils/priceEngine');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/estimate', async (req, res) => {
  try {
    const { originalPrice, ageYears, condition, title, author, category } = req.body;

    if (!originalPrice || !condition) {
      return res.status(400).json({ message: 'Original price and condition are required.' });
    }

    const comparableSales = await query(`
      SELECT sale_price AS price
      FROM exchanges
      WHERE sale_price > 0
      ORDER BY created_at DESC
      LIMIT 20
    `);

    const estimate = calculatePricingEstimate({ originalPrice, ageYears: ageYears || 0, condition }, comparableSales);

    if (req.session && req.session.user && req.session.user.id) {
      await run(`
        INSERT INTO pricing_recommendations (user_id, book_id, original_price, age_years, condition, math_estimate, market_median, hybrid_estimate, evidence_count, evidence_label, recommendation_text, config_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        req.session.user.id,
        req.body.bookId || null,
        Number(originalPrice),
        Number(ageYears || 0),
        condition,
        estimate.mathEstimate,
        estimate.comparableMedian,
        estimate.hybridEstimate,
        estimate.comparableSalesCount,
        estimate.evidenceLabel,
        estimate.recommendationText,
        estimate.formulaVersion,
      ]);
    }

    return res.status(200).json({ estimate });
  } catch (error) {
    console.error('Pricing estimate error:', error);
    return res.status(500).json({ message: 'Unable to calculate price recommendation.' });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const settings = await queryOne('SELECT * FROM pricing_settings ORDER BY id DESC LIMIT 1');
    return res.status(200).json({ settings: settings || { annualRate: 0.15 } });
  } catch (error) {
    console.error('Pricing settings error:', error);
    return res.status(500).json({ message: 'Unable to load pricing settings.' });
  }
});

module.exports = router;
