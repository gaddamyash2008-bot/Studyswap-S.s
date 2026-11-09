const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const morgan = require('morgan');

dotenv.config();

const { initializeDatabase, getDbType, pgPool } = require('./backend/config/db');
const authRouter = require('./backend/routes/auth');
const booksRouter = require('./backend/routes/books');
const dashboardRouter = require('./backend/routes/dashboard');
const pricingRouter = require('./backend/routes/pricing');

const app = express();
const port = Number(process.env.PORT || 3000);
const isPostgres = getDbType() === 'postgres';
const PgSession = isPostgres ? require('connect-pg-simple')(session) : null;

app.set('trust proxy', 1);
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use(async (req, res, next) => {
  try {
    if (process.env.VERCEL && (!process.env.DATABASE_URL || !process.env.SESSION_SECRET)) {
      return res.status(503).json({
        message: 'Set DATABASE_URL and SESSION_SECRET in the Vercel project environment variables.',
      });
    }

    await initializeDatabase();
    return next();
  } catch (error) {
    console.error('Database initialization error:', error);
    return res.status(503).json({ message: 'The application database is unavailable.' });
  }
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'study-swap-secret-key',
  resave: false,
  saveUninitialized: false,
  ...(PgSession ? {
    store: new PgSession({
      pool: pgPool,
      tableName: 'studyswap_sessions',
      createTableIfMissing: true,
    }),
  } : {}),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24,
  },
}));

app.use('/api/auth', authRouter);
app.use('/api/books', booksRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/pricing', pricingRouter);

app.use('/uploads', express.static(path.join(__dirname, 'backend', 'uploads')));
if (!process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, 'public')));
}

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

if (require.main === module) {
  startServer();
}

module.exports = app;
