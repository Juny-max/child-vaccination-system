# Backend - Child Vaccination System API

NestJS backend for the Child Vaccination Command Center.

## Deployment

This backend is configured to deploy on Railway from the `/backend` subdirectory.

### Environment Variables (set in Railway dashboard)

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJ...` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-secret-key` |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` |
| `PORT` | Server port (Railway sets this) | `3001` |
| `CORS_ORIGIN` | Frontend URL for CORS | `https://your-app.vercel.app` |

### Local Development

```bash
# Install dependencies
pnpm install

# Start in development mode
pnpm run start:dev

# Build for production
pnpm run build

# Start production server
pnpm run start:prod
```

## API Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Parent registration
- `GET /api/parent/dashboard` - Parent dashboard data
- `GET /api/parent/children` - List children
- `GET /api/parent/certificates` - Get vaccination certificates
