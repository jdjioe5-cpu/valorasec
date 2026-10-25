# Deployment Guide

## Docker Deployment

### Development

The easiest way to deploy ValoraSec in development is with Docker Compose:

```bash
# Clone the repository
git clone https://github.com/valorasec/valorasec.git
cd valorasec

# Start the full stack (development)
docker compose -f docker/docker-compose.yml up -d
```

### Production

For production, use the production profile which adds SSL via Caddy, resource limits, log rotation, and non-default credentials:

```bash
# 1. Copy and fill in the production env file
cp docker/prod.env.example docker/prod.env
# Edit docker/prod.env with your real values

# 2. Start with both compose files
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d

# 3. Verify all services are healthy
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml ps
```

**Production features:**

- **SSL/TLS**: Automatic HTTPS via Caddy with Let's Encrypt
- **Security headers**: X-Content-Type-Options, X-Frame-Options, HSTS, etc.
- **No direct port exposure**: API and web are only accessible through Caddy
- **Resource limits**: CPU and memory limits on all containers
- **Log rotation**: JSON file logging with size-based rotation
- **Redis auth**: Password-protected Redis instance
- **Health checks**: All services have health checks configured

**Prerequisites:**

1. A domain name pointing to your server (for SSL)
2. Ports 80 and 443 accessible from the internet
3. Docker and Docker Compose installed
4. `docker/prod.env` configured with real credentials

## Redis & Rate Limiting Architecture

ValoraSec incorporates a high-throughput rate limiting layer backed by Redis to protect authentication and core API endpoints from brute-force attacks and abuse.

### Rate Limiting Policies

- **Login (`/api/auth/login`)**: Max 5 attempts per IP per minute.
- **Registration (`/api/auth/register`)**: Max 3 account creations per IP per hour.
- **General API**: Max 100 requests per minute per authenticated user (or per IP if unauthenticated).
- **Health-Check Bypass**: Endpoints under `/health` unconditionally bypass rate limits for monitoring systems.

### Response Headers

When rate limiting is active, every HTTP response includes RFC-standard audit headers:

- `X-RateLimit-Limit`: Maximum requests allowed within the current window.
- `X-RateLimit-Remaining`: Remaining request quota in the active window.
- `X-RateLimit-Reset`: Unix timestamp (seconds) when quota resets.

If a client exceeds their allowance, the API replies with HTTP `429 Too Many Requests` including a `retryAfter` timestamp.

### Graceful Fallback

For local development or isolated automated testing where a live Redis server is unavailable, the API transparently falls back to an in-memory sliding window cache without service interruption.

## Environment Variables

### API (`apps/api/.env`)

| Variable                    | Description                          | Default                                                    |
| --------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| `DATABASE_URL`              | PostgreSQL connection string         | `postgresql://postgres:valorasec@localhost:5432/valorasec` |
| `JWT_SECRET`                | Secret for JWT signing               | _Required_                                                 |
| `JWT_EXPIRES_IN`            | Access token expiration              | `15m`                                                      |
| `JWT_REFRESH_EXPIRES_IN_MS` | Refresh token expiration (ms)        | `604800000` (7 days)                                       |
| `STELLAR_NETWORK`           | Network to use (`testnet`/`mainnet`) | `testnet`                                                  |
| `SOROBAN_RPC_URL`           | Soroban RPC endpoint                 | `https://soroban-testnet.stellar.org`                      |
| `REDIS_URL`                 | Redis connection string              | `redis://localhost:6379`                                   |
| `REDIS_HOST`                | Redis hostname                       | `localhost`                                                |
| `REDIS_PORT`                | Redis port                           | `6379`                                                     |
| `REDIS_PASSWORD`            | Redis password                       | _Optional_                                                 |
| `RATE_LIMIT_ENABLED`        | Enable/disable rate limiting guard   | `true`                                                     |
| `RATE_LIMIT_LOGIN_LIMIT`    | Max login attempts per window        | `5`                                                        |
| `RATE_LIMIT_LOGIN_TTL`      | Login window size (seconds)          | `60`                                                       |
| `RATE_LIMIT_REGISTER_LIMIT` | Max registration attempts per window | `3`                                                        |
| `RATE_LIMIT_REGISTER_TTL`   | Registration window size (seconds)   | `3600`                                                     |
| `RATE_LIMIT_API_LIMIT`      | Max general requests per window      | `100`                                                      |
| `RATE_LIMIT_API_TTL`        | General API window size (seconds)    | `60`                                                       |
| `PORT`                      | API server port                      | `4000`                                                     |
| `CORS_ORIGIN`               | Allowed CORS origin                  | `http://localhost:3000`                                    |

### Web (`apps/web`)

| Variable              | Description     | Default                 |
| --------------------- | --------------- | ----------------------- |
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:4000` |

## Production Considerations

1. **Use a real JWT secret** — Never use the default secret in production
2. **Enable HTTPS** — Use a reverse proxy like nginx or Caddy
3. **Set up monitoring** — Configure logging and metrics
4. **Database backups** — Set up regular PostgreSQL backups
5. **Rate limiting** — Rate limiting is active by default; ensure Redis connection is healthy
6. **Mainnet mode** — Set `STELLAR_NETWORK=mainnet` for production

## Manual Deployment

### API

```bash
cd apps/api
pnpm build
node dist/main.js
```

### Web

```bash
cd apps/web
pnpm build
pnpm start
```
