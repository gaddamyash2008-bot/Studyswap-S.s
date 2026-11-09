const express = require('express');
const bcrypt = require('bcryptjs');
const { queryOne, query, run, getDbType } = require('../config/db');

const router = express.Router();

function getInsertedId(result) {
  if (!result) return null;
  if (typeof result.lastID === 'number') return result.lastID;
  if (result.rows && result.rows[0] && result.rows[0].id) return result.rows[0].id;
  return null;
}

function safeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name || row.fullName,
    email: row.email,
    role: row.role,
    city: row.city,
    state: row.state,
    area: row.area,
    pinCode: row.pin_code || row.pinCode,
    isVerified: Boolean(row.is_verified),
  };
}

router.get('/me', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(200).json({ user: null });
  }

  const user = await queryOne('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(200).json({ user: null });
  }

  return res.status(200).json({ user: safeUser(user) });
});

router.post('/register', async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      confirmPassword,
      role,
      city,
      state,
      area,
      pinCode,
    } = req.body;

    if (!fullName || !email || !password || !confirmPassword || !role) {
      return res.status(400).json({ message: 'Please fill in all required fields.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    const normalizedRole = role === 'seller' || role === 'buyer' || role === 'admin' ? role : 'buyer';

    const existingUser = await queryOne('SELECT id FROM users WHERE email = ?', [String(email).trim().toLowerCase()]);
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const dbType = getDbType();
    const insertSql = dbType === 'postgres'
      ? `INSERT INTO users (full_name, email, password_hash, role, city, state, area, pin_code, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`
      : `INSERT INTO users (full_name, email, password_hash, role, city, state, area, pin_code, is_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [fullName.trim(), String(email).trim().toLowerCase(), passwordHash, normalizedRole, city || '', state || '', area || '', pinCode || '', 1];

    const result = dbType === 'postgres'
      ? await queryOne(insertSql, params)
      : await run(insertSql, params);

    const userId = dbType === 'postgres' ? result.id : getInsertedId(result);
    const createdUser = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    const sessionUser = safeUser(createdUser);

    req.session.user = sessionUser;

    return res.status(201).json({
      message: 'Account created successfully.',
      user: sessionUser,
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await queryOne('SELECT * FROM users WHERE email = ?', [String(email).trim().toLowerCase()]);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    req.session.user = safeUser(user);

    return res.status(200).json({
      message: 'Logged in successfully.',
      user: safeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.status(200).json({ message: 'Logged out successfully.' });
  });
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await queryOne('SELECT * FROM users WHERE email = ?', [String(email).trim().toLowerCase()]);
    if (!user) {
      return res.status(200).json({ message: 'If an account exists, a reset token has been created.' });
    }

    const token = `studyswap-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    await run('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, token, expiresAt]);

    return res.status(200).json({
      message: 'Password reset token generated.',
      token,
      resetUrl: `/reset-password?token=${token}`,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Password reset request failed.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Reset token and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const resetRecord = await queryOne('SELECT * FROM password_reset_tokens WHERE token = ? AND expires_at > ?', [token, new Date().toISOString()]);
    if (!resetRecord) {
      return res.status(400).json({ message: 'Invalid or expired password reset token.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, resetRecord.user_id]);
    await run('DELETE FROM password_reset_tokens WHERE token = ?', [token]);

    return res.status(200).json({ message: 'Password reset successful.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Password reset failed.' });
  }
});

module.exports = router;
