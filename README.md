# StudySwap

StudySwap is a student-to-student marketplace for buying, selling and exchanging academic books. The project uses a Node.js + Express.js backend, a vanilla HTML/CSS/JavaScript frontend, and a PostgreSQL-compatible database setup with a SQLite fallback for local development.

## Features

- Premium landing page and brand design
- Buyer and seller authentication with role-based access
- Book listings, category filtering and search
- Wishlist support and dashboard views
- AI-assisted price recommendation workflow
- Book request support for unavailable titles
- Sustainability and reuse metrics based on actual exchange records
- Structured backend routes and database initialization scripts

## Prerequisites

- Node.js 18+
- npm
- Optional PostgreSQL connection string for production use
- Optional Cloudinary credentials for persistent image hosting

## Local setup

1. Copy `.env.example` to `.env`.
2. Update environment values if needed.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Initialize the database tables:
   ```bash
   npm run db:init
   ```
5. Start the app:
   ```bash
   npm start
   ```
6. Open `http://localhost:3000`.

## Environment notes

- If `DATABASE_URL` is not configured, the app uses a local SQLite database file under `backend/data/studyswap.db` so the project can run without external credentials.
- If `DATABASE_URL` is configured to Neon PostgreSQL, the app uses PostgreSQL-compatible tables and queries instead.
- PostgreSQL deployments store login sessions in the database; local SQLite development uses the default in-memory session store.
- `CLOUDINARY_*` values are optional. If they are not configured, uploaded image URLs can still be stored as local paths or external image URLs.

## Production deployment guidance

### Vercel and Neon

The Express application is exported from `server.js` for Vercel. Vercel serves files from `public/` as static assets, while the Express function handles application routes and APIs.

1. Create a Neon PostgreSQL project and copy its pooled connection string.
2. In Vercel, open the project settings and add these Production environment variables:
   - `DATABASE_URL`: the Neon connection string. Keep it private.
   - `SESSION_SECRET`: a long, random secret used to sign login sessions.
   - `NODE_ENV`: `production`.
3. Redeploy the Production deployment. The app creates its tables on first request; no local SQLite database file is uploaded.
4. Verify `https://your-project.vercel.app/api/health` returns a healthy response and reports `postgres`.

The service returns a clear configuration error when `DATABASE_URL` or `SESSION_SECRET` is missing in Vercel. Set Preview and Development variables too if those deployments need to use a database.

## Manual configuration required

The project does not include Neon credentials, Cloudinary keys, or deployment secrets. Add secrets only in your hosting provider's environment-variable settings; never commit them.

## Security notes

- Never commit `.env` files or real secrets.
- Passwords are hashed with bcrypt.
- Session data is stored server-side and protected by a secret key.
