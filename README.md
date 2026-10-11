# ThoughtExpense Admin

Internal SaaS console for operators: growth, users, subscriptions, and system health.

## Stack

- Next.js 16 (App Router)
- shadcn/ui + Tailwind CSS v4
- Dedicated **Admin** accounts on the API (`/api/admin/auth/login`)

## Setup

```bash
cd admin
pnpm install
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:7100
pnpm dev   # http://localhost:3022
```

### Create an admin account (on the server)

Apply migrations, then:

```bash
cd server
pnpm prisma migrate deploy   # or migrate dev locally
pnpm admin:create -- --email ops@example.com --password 'a-long-passphrase' --name "Ops"   # 12+ characters
pnpm admin:totp -- --email ops@example.com   # two-factor sign-in: add the printed key to an authenticator app
```

Sign in at `/login` with that **email and password** (not a regular app user), then the 6-digit authenticator code. Once every admin has two-factor set up, set `ADMIN_REQUIRE_TOTP=true` on the server.

Five failed sign-ins lock an account for 15 minutes. Every sign-in and every lock is announced on Telegram.

For **RevenueCat entitlement checks** on Operations, set `REVENUECAT_SECRET_API_KEY` (and optionally `REVENUECAT_ENTITLEMENT_ID`) on the server.

## Pages

| Route | Purpose |
|-------|---------|
| `/dashboard` | Needs-attention list (alerts, drift, failed jobs, stale backups, AI cost flags), then key figures |
| `/dashboard/users` | Search and filter accounts; search, filter and page live in the URL |
| `/dashboard/users/[id]` | Plan, RevenueCat comparison, usage, AI cost, webhooks; grant/revoke premium, moderation |
| `/dashboard/subscriptions` | Premium segments and status breakdown |
| `/dashboard/growth` | Daily signups with period-over-period change |
| `/dashboard/billing` | Clear stale premium, inconsistent accounts, RevenueCat webhook log |
| `/dashboard/operations` | AI usage, AI cost per user, job queues, RevenueCat check (on demand), search index |
| `/dashboard/system` | Service health, deployed version, migrations, alerts, backups |
| `/dashboard/audit` | Every console action, filterable by action (server-side) |

The top bar finds any user by email or name (press `/`). Sidebar counts show open attention items per section; they refresh every 5 minutes.

## Security

- Admin tokens are separate from user JWTs (`admin_access` purpose).
- Do not expose this app publicly without VPN or SSO in front.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`), aligned with `thought-expense-server`:

| Job | When | What |
|-----|------|------|
| **test** | PR + push to `main` | `pnpm install`, lint, typecheck, `next build` |
| **deploy** | push to `main` only | SSH to VPS: pull, build, `pm2 restart thought-admin` |

**Repository secrets** (same as server): `VPS_HOST`, `USERNAME`, `VPS_PASSWORD`.

**VPS layout** (adjust in the workflow if your path differs):

```text
/var/www/personal/thoughtExpense/admin
```

On the VPS, keep `.env` with production `NEXT_PUBLIC_API_URL` **before** `pnpm build` (Next inlines public env at build time). Run with `pnpm start` on port **3022** under PM2, e.g. `pm2 start pnpm --name thought-admin -- start`.
