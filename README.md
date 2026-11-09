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
- If `DATABASE_URL` is configured to Neon PostgreSQL, the app uses that database instead.
- `CLOUDINARY_*` values are optional. If they are not configured, uploaded image URLs can still be stored as local paths or external image URLs.

## Production deployment guidance

- Connect the repository to GitHub.
- Configure `DATABASE_URL` for Neon PostgreSQL.
- Add `SESSION_SECRET` and `CLOUDINARY_*` secrets in Render.
- Ensure build and start commands are set appropriately for Node.js.
- Run the database initialization step in the production environment before launch.

## Manual configuration required

The default system intentionally does not ship with real Neon credentials, Cloudinary keys, or live deployment secrets. You must provide those in your own environment or hosting platform before public production use.

## Security notes

- Never commit `.env` files or real secrets.
- Passwords are hashed with bcrypt.
- Session data is stored server-side and protected by a secret key.
