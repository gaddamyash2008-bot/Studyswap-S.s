const express = require('express');
const { query, queryOne, run, getDbType } = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function getInsertedId(result) {
  if (!result) return null;
  if (typeof result.lastID === 'number') return result.lastID;
  if (result.rows && result.rows[0] && result.rows[0].id) return result.rows[0].id;
  return null;
}

router.get('/', async (req, res) => {
  try {
    const { category, city, minPrice, maxPrice, search } = req.query;

    let sql = `
      SELECT b.*, u.full_name AS seller_name, u.city AS seller_city, u.area AS seller_area,
             (SELECT i.image_url FROM book_images i WHERE i.book_id = b.id ORDER BY i.id ASC LIMIT 1) AS cover_image
      FROM books b
      INNER JOIN users u ON u.id = b.seller_id
      WHERE b.status != 'removed'
    `;
    const params = [];

    if (category) {
      sql += ' AND b.category = ?';
      params.push(category);
    }

    if (city) {
      sql += ' AND b.city = ?';
      params.push(city);
    }

    if (minPrice) {
      sql += ' AND b.expected_selling_price >= ?';
      params.push(Number(minPrice));
    }

    if (maxPrice) {
      sql += ' AND b.expected_selling_price <= ?';
      params.push(Number(maxPrice));
    }

    if (search) {
      sql += ' AND (LOWER(b.title) LIKE LOWER(?) OR LOWER(b.author) LIKE LOWER(?) OR LOWER(b.subject) LIKE LOWER(?))';
      const pattern = `%${String(search).trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    sql += ' ORDER BY b.created_at DESC';

    const books = await query(sql, params);
    return res.status(200).json({ books });
  } catch (error) {
    console.error('List books error:', error);
    return res.status(500).json({ message: 'Unable to fetch books.' });
  }
});

router.get('/nearby', async (req, res) => {
  try {
    const { city, area, pinCode } = req.query;
    if (!city && !area && !pinCode) {
      return res.status(400).json({ message: 'Provide a city, area or PIN code to search nearby listings.' });
    }

    let sql = `
      SELECT b.*, u.full_name AS seller_name,
             (SELECT i.image_url FROM book_images i WHERE i.book_id = b.id ORDER BY i.id ASC LIMIT 1) AS cover_image
      FROM books b
      INNER JOIN users u ON u.id = b.seller_id
      WHERE b.status = 'available'
    `;
    const params = [];

    if (city) {
      sql += ' AND LOWER(b.city) = LOWER(?)';
      params.push(city);
    }

    if (area) {
      sql += ' AND LOWER(b.area) = LOWER(?)';
      params.push(area);
    }

    if (pinCode) {
      sql += ' AND b.pin_code = ?';
      params.push(pinCode);
    }

    sql += ' ORDER BY b.created_at DESC';

    const books = await query(sql, params);
    return res.status(200).json({ books });
  } catch (error) {
    console.error('Nearby books error:', error);
    return res.status(500).json({ message: 'Unable to find nearby books.' });
  }
});

router.post('/wishlist', requireAuth, async (req, res) => {
  try {
    const { bookId } = req.body;
    if (!bookId) {
      return res.status(400).json({ message: 'Book ID is required.' });
    }

    const existing = await queryOne('SELECT id FROM wishlists WHERE user_id = ? AND book_id = ?', [req.session.user.id, bookId]);
    if (existing) {
      return res.status(200).json({ message: 'Book is already in your wishlist.' });
    }

    await run('INSERT INTO wishlists (user_id, book_id) VALUES (?, ?)', [req.session.user.id, bookId]);
    return res.status(201).json({ message: 'Book added to wishlist.' });
  } catch (error) {
    console.error('Wishlist error:', error);
    return res.status(500).json({ message: 'Unable to update wishlist.' });
  }
});

router.get('/wishlist/:userId', requireAuth, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const books = await query(`
      SELECT b.*, u.full_name AS seller_name,
             (SELECT i.image_url FROM book_images i WHERE i.book_id = b.id ORDER BY i.id ASC LIMIT 1) AS cover_image
      FROM wishlists w
      INNER JOIN books b ON b.id = w.book_id
      INNER JOIN users u ON u.id = b.seller_id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
    `, [userId]);

    return res.status(200).json({ books });
  } catch (error) {
    console.error('Get wishlist error:', error);
    return res.status(500).json({ message: 'Unable to fetch wishlist.' });
  }
});

router.route('/requests')
  .post(requireAuth, async (req, res) => {
    try {
      const { title, author, category, maxBudget, city, area, notes } = req.body;

      if (!title || !String(title).trim()) {
        return res.status(400).json({ message: 'Book title is required.' });
      }

      await run(`
        INSERT INTO book_requests (user_id, title, author, category, max_budget, city, area, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')
      `, [
        req.session.user.id,
        String(title).trim(),
        String(author || '').trim(),
        String(category || 'General Academic').trim(),
        Number(maxBudget || 0),
        String(city || '').trim(),
        String(area || '').trim(),
        String(notes || '').trim(),
      ]);

      return res.status(201).json({ message: 'Book request submitted successfully.' });
    } catch (error) {
      console.error('Book request error:', error);
      return res.status(500).json({ message: 'Unable to submit the book request.' });
    }
  })
  .get(requireAuth, async (req, res) => {
    try {
      const requests = await query('SELECT * FROM book_requests WHERE user_id = ? ORDER BY created_at DESC', [req.session.user.id]);
      return res.status(200).json({ requests });
    } catch (error) {
      console.error('Get book requests error:', error);
      return res.status(500).json({ message: 'Unable to fetch your book requests.' });
    }
  });

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const book = await queryOne(`
      SELECT b.*, u.full_name AS seller_name, u.city AS seller_city, u.area AS seller_area, u.pin_code AS seller_pin_code,
             (SELECT i.image_url FROM book_images i WHERE i.book_id = b.id ORDER BY i.id ASC LIMIT 1) AS cover_image
      FROM books b
      INNER JOIN users u ON u.id = b.seller_id
      WHERE b.id = ?
    `, [id]);

    if (!book) {
      return res.status(404).json({ message: 'Book not found.' });
    }

    const images = await query('SELECT * FROM book_images WHERE book_id = ? ORDER BY id ASC', [id]);
    return res.status(200).json({ book: { ...book, images } });
  } catch (error) {
    console.error('Get book error:', error);
    return res.status(500).json({ message: 'Unable to view book details.' });
  }
});

router.post('/', requireAuth, requireRole(['seller', 'admin']), async (req, res) => {
  try {
    const bookPayload = req.body;
    const requiredFields = ['title', 'author', 'category', 'condition', 'originalPrice', 'expectedSellingPrice'];
    const missingField = requiredFields.find((field) => !bookPayload[field] && bookPayload[field] !== 0);

    if (missingField) {
      return res.status(400).json({ message: `${missingField} is required.` });
    }

    if (Number(bookPayload.originalPrice) <= 0) {
      return res.status(400).json({ message: 'Original purchase price must be greater than zero.' });
    }

    const title = String(bookPayload.title).trim();
    const author = String(bookPayload.author).trim();
    const category = String(bookPayload.category).trim();
    const condition = String(bookPayload.condition).trim();
    const description = String(bookPayload.description || '').trim();

    const dbType = getDbType();
    const insertSql = dbType === 'postgres'
      ? `INSERT INTO books (seller_id, title, author, category, subject, edition, publication_year, original_price, age_years, condition, expected_selling_price, description, city, state, area, pin_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id`
      : `INSERT INTO books (seller_id, title, author, category, subject, edition, publication_year, original_price, age_years, condition, expected_selling_price, description, city, state, area, pin_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
      req.session.user.id,
      title,
      author,
      category,
      bookPayload.subject || '',
      bookPayload.edition || '',
      Number(bookPayload.publicationYear || 0),
      Number(bookPayload.originalPrice),
      Number(bookPayload.ageYears || 0),
      condition,
      Number(bookPayload.expectedSellingPrice),
      description,
      bookPayload.city || '',
      bookPayload.state || '',
      bookPayload.area || '',
      bookPayload.pinCode || '',
    ];

    const insertResult = dbType === 'postgres'
      ? await queryOne(insertSql, params)
      : await run(insertSql, params);

    const createdBookId = dbType === 'postgres' ? insertResult.id : getInsertedId(insertResult);

    const imageUrls = Array.isArray(bookPayload.images) ? bookPayload.images : [];
    for (const imageUrl of imageUrls) {
      if (!imageUrl) continue;
      await run('INSERT INTO book_images (book_id, image_url) VALUES (?, ?)', [createdBookId, imageUrl]);
    }

    const createdBook = await queryOne('SELECT * FROM books WHERE id = ?', [createdBookId]);
    return res.status(201).json({ message: 'Book listing created successfully.', book: createdBook });
  } catch (error) {
    console.error('Create book error:', error);
    return res.status(500).json({ message: 'Unable to create the book listing.' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const existingBook = await queryOne('SELECT * FROM books WHERE id = ? AND seller_id = ?', [id, req.session.user.id]);
    if (!existingBook) {
      return res.status(403).json({ message: 'You can only edit your own listings.' });
    }

    const fields = [
      ['title', req.body.title],
      ['author', req.body.author],
      ['category', req.body.category],
      ['subject', req.body.subject],
      ['edition', req.body.edition],
      ['publication_year', req.body.publicationYear],
      ['original_price', req.body.originalPrice],
      ['age_years', req.body.ageYears],
      ['condition', req.body.condition],
      ['expected_selling_price', req.body.expectedSellingPrice],
      ['description', req.body.description],
      ['city', req.body.city],
      ['state', req.body.state],
      ['area', req.body.area],
      ['pin_code', req.body.pinCode],
      ['status', req.body.status],
    ].filter(([, value]) => value !== undefined && value !== null && value !== '');

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No book changes were provided.' });
    }

    const sets = fields.map(([key]) => `${key} = ?`).join(', ');
    const values = fields.map(([, value]) => value);
    values.push(id);

    await run(`UPDATE books SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);

    const updatedBook = await queryOne('SELECT * FROM books WHERE id = ?', [id]);
    return res.status(200).json({ message: 'Book updated successfully.', book: updatedBook });
  } catch (error) {
    console.error('Update book error:', error);
    return res.status(500).json({ message: 'Unable to update book listing.' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const existingBook = await queryOne('SELECT * FROM books WHERE id = ? AND seller_id = ?', [id, req.session.user.id]);
    if (!existingBook) {
      return res.status(403).json({ message: 'You can only delete your own listings.' });
    }

    await run('DELETE FROM book_images WHERE book_id = ?', [id]);
    await run('DELETE FROM books WHERE id = ?', [id]);

    return res.status(200).json({ message: 'Book listing deleted successfully.' });
  } catch (error) {
    console.error('Delete book error:', error);
    return res.status(500).json({ message: 'Unable to delete book listing.' });
  }
});

module.exports = router;
