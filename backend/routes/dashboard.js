const express = require('express');
const { queryOne, query } = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/overview', async (req, res) => {
  try {
    const reusedCount = await queryOne('SELECT COUNT(*) AS count FROM exchanges WHERE status = ?', ['completed']);
    const sellerCount = await queryOne('SELECT COUNT(*) AS count FROM users WHERE role = ?', ['seller']);
    const savings = await queryOne(`
      SELECT COALESCE(SUM(b.original_price - e.sale_price), 0) AS total
      FROM exchanges e
      INNER JOIN books b ON b.id = e.book_id
      WHERE e.status = ?
    `, ['completed']);

    return res.status(200).json({
      stats: {
        reusedCount: Number(reusedCount?.count || 0),
        sellerCount: Number(sellerCount?.count || 0),
        savings: Number(savings?.total || 0),
      },
    });
  } catch (error) {
    console.error('Overview stats error:', error);
    return res.status(500).json({ message: 'Unable to load marketplace statistics.' });
  }
});

router.get('/buyer', requireAuth, requireRole(['buyer', 'admin']), async (req, res) => {
  try {
    const userId = req.session.user.id;

    const wishlistCount = await queryOne('SELECT COUNT(*) AS count FROM wishlists WHERE user_id = ?', [userId]);
    const activeRequests = await queryOne('SELECT COUNT(*) AS count FROM book_requests WHERE user_id = ? AND status = ?', [userId, 'open']);
    const pendingOffers = await queryOne('SELECT COUNT(*) AS count FROM offers WHERE buyer_id = ? AND status = ?', [userId, 'pending']);
    const completedExchanges = await queryOne('SELECT COUNT(*) AS count FROM exchanges WHERE buyer_id = ?', [userId]);

    const recentBooks = await query(`
      SELECT b.*, u.full_name AS seller_name,
             (SELECT i.image_url FROM book_images i WHERE i.book_id = b.id ORDER BY i.id ASC LIMIT 1) AS cover_image
      FROM books b
      INNER JOIN users u ON u.id = b.seller_id
      ORDER BY b.created_at DESC
      LIMIT 8
    `);

    const myWishlist = await query(`
      SELECT b.*, u.full_name AS seller_name,
             (SELECT i.image_url FROM book_images i WHERE i.book_id = b.id ORDER BY i.id ASC LIMIT 1) AS cover_image
      FROM wishlists w
      INNER JOIN books b ON b.id = w.book_id
      INNER JOIN users u ON u.id = b.seller_id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
    `, [userId]);

    const myRequests = await query('SELECT * FROM book_requests WHERE user_id = ? ORDER BY created_at DESC', [userId]);

    return res.status(200).json({
      user: req.session.user,
      stats: {
        wishlistCount: Number(wishlistCount?.count || 0),
        activeRequests: Number(activeRequests?.count || 0),
        pendingOffers: Number(pendingOffers?.count || 0),
        completedExchanges: Number(completedExchanges?.count || 0),
      },
      books: recentBooks,
      wishlist: myWishlist,
      requests: myRequests,
    });
  } catch (error) {
    console.error('Buyer dashboard error:', error);
    return res.status(500).json({ message: 'Unable to load your dashboard.' });
  }
});

router.get('/seller', requireAuth, requireRole(['seller', 'admin']), async (req, res) => {
  try {
    const userId = req.session.user.id;

    const activeListings = await queryOne('SELECT COUNT(*) AS count FROM books WHERE seller_id = ? AND status = ?', [userId, 'available']);
    const pendingOffers = await queryOne('SELECT COUNT(*) AS count FROM offers WHERE seller_id = ? AND status = ?', [userId, 'pending']);
    const completedSales = await queryOne('SELECT COUNT(*) AS count FROM exchanges WHERE seller_id = ?', [userId]);
    const totalEarnings = await queryOne('SELECT COALESCE(SUM(sale_price), 0) AS total FROM exchanges WHERE seller_id = ?', [userId]);

    const listings = await query(`
      SELECT b.*,
             (SELECT i.image_url FROM book_images i WHERE i.book_id = b.id ORDER BY i.id ASC LIMIT 1) AS cover_image
      FROM books b
      WHERE b.seller_id = ?
      ORDER BY b.created_at DESC
    `, [userId]);

    const offers = await query(`
      SELECT o.*, b.title AS book_title, u.full_name AS buyer_name
      FROM offers o
      INNER JOIN books b ON b.id = o.book_id
      INNER JOIN users u ON u.id = o.buyer_id
      WHERE o.seller_id = ?
      ORDER BY o.created_at DESC
    `, [userId]);

    return res.status(200).json({
      user: req.session.user,
      stats: {
        activeListings: Number(activeListings?.count || 0),
        pendingOffers: Number(pendingOffers?.count || 0),
        completedSales: Number(completedSales?.count || 0),
        totalEarnings: Number(totalEarnings?.total || 0),
      },
      listings,
      offers,
    });
  } catch (error) {
    console.error('Seller dashboard error:', error);
    return res.status(500).json({ message: 'Unable to load seller dashboard.' });
  }
});

router.get('/admin', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const users = await query('SELECT id, full_name, email, role, city, state, created_at FROM users ORDER BY created_at DESC LIMIT 20');
    const books = await query('SELECT id, title, category, condition, status, seller_id FROM books ORDER BY created_at DESC LIMIT 20');
    const exchanges = await query('SELECT * FROM exchanges ORDER BY created_at DESC LIMIT 20');

    return res.status(200).json({
      user: req.session.user,
      users,
      books,
      exchanges,
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    return res.status(500).json({ message: 'Unable to load admin dashboard.' });
  }
});

module.exports = router;
