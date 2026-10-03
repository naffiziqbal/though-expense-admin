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
pnpm dev   # http://localhost:3020
```

### Create an admin account (on the server)

Apply migrations, then:

```bash
cd server
pnpm prisma migrate deploy   # or migrate dev locally
pnpm admin:create -- --email ops@example.com --password 'YourSecurePass123' --name "Ops"
```

Sign in at `/login` with that **email and password** (not a regular app user).

## Pages

| Route | Purpose |
|-------|---------|
| `/dashboard` | KPIs: users, premium, signups, expenses, devices |
| `/dashboard/growth` | Daily signup chart |
| `/dashboard/users` | Search and paginate app users |
| `/dashboard/subscriptions` | Premium counts |
| `/dashboard/system` | API health |

## Security

- Admin tokens are separate from user JWTs (`admin_access` purpose).
- Do not expose this app publicly without VPN or SSO in front.
