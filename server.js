const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const morgan = require('morgan');

dotenv.config();

const { initializeDatabase } = require('./backend/config/db');
const authRouter = require('./backend/routes/auth');
const booksRouter = require('./backend/routes/books');
const dashboardRouter = require('./backend/routes/dashboard');
const pricingRouter = require('./backend/routes/pricing');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'study-swap-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 24,
  },
}));

app.use('/api/auth', authRouter);
app.use('/api/books', booksRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/pricing', pricingRouter);

app.use('/uploads', express.static(path.join(__dirname, 'backend', 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    app: 'StudySwap',
    uptime: process.uptime(),
    db: process.env.DATABASE_URL ? 'postgres' : 'sqlite',
  });
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API route not found.' });
  }
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(port, () => {
      console.log(`StudySwap server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start StudySwap:', error);
    process.exit(1);
  }
}

startServer();
