# Backend - Child Vaccination System API

NestJS backend for the Child Vaccination Command Center.

## Deployment

The service currently deploys to **Render** from the `/backend` subdirectory. Use these settings:

- Branch: `main`
- Root Directory: `backend`
- Build Command: `pnpm install && pnpm run build`
- Start Command: `pnpm run start:prod`

### Environment Variables (set in Railway dashboard)

| Variable | Description | Example |
| ---------- | ------------- | --------- |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJ...` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-secret-key` |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` |
| `PORT` | Server port (Railway sets this) | `3001` |
| `CORS_ORIGIN` | Frontend URL for CORS | `https://your-app.vercel.app` |

### Environment Variables

Create `.env` in this folder and fill in:

```env
SUPABASE_URL=https://pvzatstzlvtaequsqhec.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key from Supabase console>
JWT_SECRET=<choose a long random string>
PORT=3001
CORS_ORIGIN=http://localhost:3000
BACKUP_DIR=./backups
BACKUP_ENCRYPTION_KEY=<64 hex chars>
BACKUP_RETENTION_DAYS=30
```

Generate a 64-character hex key for `BACKUP_ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

For Render, copy the same values into the dashboard (plus `NODE_ENV=production` and your production `CORS_ORIGIN`).

### Local Development

```bash
# Install dependencies once
pnpm install

# Start in development mode (watches files)
pnpm run start:dev

# Build for production output
pnpm run build

# Run the built server
pnpm run start:prod
```

### Quick sanity test

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"akosua.asante@example.com","password":"password1234","userType":"parent"}'

# HQ admin login
curl -X POST http://localhost:3001/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@health.gov.gh","password":"password1234"}'
```

## API Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/admin/login` - HQ admin login
- `POST /api/auth/register` - Parent registration
- `GET /api/parent/dashboard` - Parent dashboard data
- `GET /api/parent/children` - List children
- `GET /api/parent/certificates` - Get vaccination certificates
