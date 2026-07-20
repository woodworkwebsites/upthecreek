# Up the Creek Padel

Ecommerce storefront for Up the Creek Padel & Social Club. Built with React, TypeScript, Stripe Checkout, and Cloudflare Pages.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS |
| Build | Vite |
| Hosting | Cloudflare Pages |
| API / SSR | Cloudflare Pages Functions |
| Database | Cloudflare D1 (SQLite) |
| Payments | Stripe Checkout |
| Fulfilment | Manual / admin-managed |

## Local Development

```bash
npm install
npm run db:migrate:local
npm run dev
```

The dev server runs on:
- `http://localhost:5173` for the Vite frontend
- `http://localhost:8788` for the Pages Functions proxy

## Environment Variables

Set these in `.dev.vars` locally and in Cloudflare Pages for production:

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY_TEST` | Stripe test secret key |
| `STRIPE_SECRET_KEY_LIVE` | Stripe live secret key |
| `STRIPE_WEBHOOK_SECRET_TEST` | Stripe test webhook secret |
| `STRIPE_WEBHOOK_SECRET_LIVE` | Stripe live webhook secret |
| `LIVE_ORDERS_ENABLED` | Must be `true` to allow live order processing |
| `ADMIN_TOKEN` | Secret token for the admin panel |
| `SMTP_HOST` | SMTP host for order notification emails |
| `SMTP_PORT` | SMTP port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password or app password |
| `SMTP_FROM` | Sender address for email notifications |
| `SMTP_SECURE` | Set to `true` for TLS |
| `ORDER_NOTIFICATION_EMAIL_TO` | Primary notification recipient |
| `ORDER_NOTIFICATION_EMAIL_CC` | CC recipient for notifications |

## Stripe Setup

1. Create a Stripe account.
2. Add the test and live secret keys to your environment.
3. Run the Stripe CLI locally and forward `checkout.session.completed` to `/api/webhooks/stripe`.
4. Add the webhook secrets to your environment.

## Admin Panel

Open `/admin` and sign in with `ADMIN_TOKEN`.

Key pages:
- `/admin/orders`
- `/admin/products`
- `/admin/logs`
- `/admin/partners`
- `/admin/settings`

## Deployment

1. Create the D1 database and apply migrations.
2. Set the environment variables in Cloudflare Pages.
3. Run a production build.
4. Deploy with Wrangler or your Cloudflare Pages workflow.

## API

Public:
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/checkout`
- `POST /api/webhooks/stripe`

Admin:
- `GET /api/admin/orders`
- `GET /api/admin/products`
- `GET /api/admin/logs`
- `GET /api/admin/settings`
- `PATCH /api/admin/settings`

## Notes

- Orders are recorded in D1 and fulfilled manually by the team.
- The product and basket flow is driven by the cached product records in the database.
