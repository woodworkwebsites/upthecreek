# Up the Creek Padel

Ecommerce storefront for Up the Creek Padel & Social Club. Sells humorous premium padel apparel via Printify, using Stripe Checkout for payments, hosted on Cloudflare Pages.

---

## Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | React + TypeScript + Tailwind CSS |
| Build       | Vite                              |
| Hosting     | Cloudflare Pages                  |
| API / SSR   | Cloudflare Pages Functions        |
| Database    | Cloudflare D1 (SQLite)            |
| Payments    | Stripe Checkout                   |
| Fulfilment  | Printify API                      |
| CLI         | Wrangler                          |

---

## Installation

```bash
npm install
```

---

## Local Development

### 1. Copy environment variables

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` with your real test credentials. Never commit this file.

### 2. Create the local database and apply migrations

```bash
npm run db:migrate:local
```

### 3. Start the development server

```bash
npm run dev
```

This runs:
- **Vite** on `http://localhost:5173` (React frontend with HMR)
- **Wrangler Pages Dev** on `http://localhost:8788` (API functions + D1 proxy)

Open `http://localhost:8788` in your browser.

### 4. Forward Stripe webhooks (separate terminal)

Install the [Stripe CLI](https://stripe.com/docs/stripe-cli), then:

```bash
stripe listen --forward-to http://localhost:8788/api/webhooks/stripe
```

Copy the webhook secret it outputs and set it as `STRIPE_WEBHOOK_SECRET` in `.dev.vars`.

---

## Environment Variables

All variables live in `.dev.vars` locally and in Cloudflare Pages → Settings → Environment Variables for production.

| Variable               | Description                                         | Example              |
|------------------------|-----------------------------------------------------|----------------------|
| `STRIPE_SECRET_KEY`    | Stripe secret key                                   | `sk_test_…`          |
| `STRIPE_WEBHOOK_SECRET`| Stripe webhook signing secret                       | `whsec_…`            |
| `PRINTIFY_API_TOKEN`   | Printify personal access token                      |                      |
| `PRINTIFY_SHOP_ID`     | Printify shop ID (numeric)                          |                      |
| `PRINTIFY_MODE`        | `dry_run` \| `draft` \| `live`                     | `dry_run`            |
| `LIVE_ORDERS_ENABLED`  | Must be `true` to allow live mode                   | `false`              |
| `ADMIN_TOKEN`          | Secret token for the admin panel                    | `dev-token`          |
| `SITE_URL`             | Canonical URL of the site                           | `http://localhost:8788` |
| `ENVIRONMENT`          | `local` \| `preview` \| `production`               | `local`              |

---

## Stripe Setup

1. Create a [Stripe account](https://stripe.com).
2. Copy your **test** secret key (`sk_test_…`) into `.dev.vars`.
3. Run `stripe listen --forward-to http://localhost:8788/api/webhooks/stripe` and copy the webhook secret.
4. For production, create a webhook endpoint in the Stripe dashboard pointing at `https://yourdomain.com/api/webhooks/stripe`, selecting the `checkout.session.completed` event.
5. Enable Stripe receipt emails in the Stripe dashboard if you want Stripe to send customer confirmation emails.

---

## Printify Setup

1. Log in to [Printify](https://printify.com) and create your products.
2. Generate a **Personal Access Token** in Printify → My Account → Connections.
3. Find your Shop ID at `https://api.printify.com/v1/shops.json` (use the `id` field).
4. Add both values to `.dev.vars`.
5. Sync products: `POST /api/admin/sync-products` (or use the Admin Products page).

---

## Product Sync

Products are maintained in Printify. The website caches them in D1.

**Sync via Admin UI:**  
Go to `/admin/products` and click **Sync from Printify**.

**Sync via API:**
```bash
curl -X POST http://localhost:8788/api/admin/sync-products \
  -H "Authorization: Bearer dev-token"
```

Synced data: title, description, images, colours, sizes, pricing, Printify product ID, variant IDs.

---

## Printify Modes

Set `PRINTIFY_MODE` in your environment:

| Mode       | Behaviour                                                         |
|------------|-------------------------------------------------------------------|
| `dry_run`  | No API call. Payload stored in D1. Order ID prefixed `dryrun_`.  |
| `draft`    | Real Printify API call. Order created but not forced to production. |
| `live`     | Real production order. Requires `LIVE_ORDERS_ENABLED=true` AND `ENVIRONMENT=production`. |

**Default is always `dry_run`.** Local environment forces `dry_run` unless explicitly set to `draft`.

---

## Dry Run Testing

The full local verification loop without involving Stripe:

```bash
# 1. Start wrangler
npm run dev

# 2. Test payload generation
curl -X POST http://localhost:8788/api/admin/test-printify-payload \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{
    "printifyId": "your-printify-product-id",
    "variantId": 12345,
    "quantity": 1,
    "address": {
      "firstName": "Test",
      "lastName": "User",
      "email": "test@example.com",
      "phone": "07700000000",
      "country": "GB",
      "address1": "1 Test Street",
      "address2": "",
      "city": "London",
      "zip": "SW1A 1AA"
    }
  }'

# 3. Full dry-run order (no Stripe needed)
curl -X POST http://localhost:8788/api/admin/test-order-handoff \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{"printifyId": "your-printify-product-id", "variantId": 12345, "quantity": 1}'

# 4. Inspect the result in Admin → Orders
```

---

## Draft Mode Testing

To validate the Printify API with a real (but draft) order:

1. Set `PRINTIFY_MODE=draft` in `.dev.vars`.
2. Run the test order handoff endpoint above.
3. Check Printify dashboard — the order will appear there.

---

## Full Stripe Test Flow

```bash
# Terminal 1
npm run dev

# Terminal 2
stripe listen --forward-to http://localhost:8788/api/webhooks/stripe

# Browser
# 1. Open http://localhost:8788
# 2. Browse to a product
# 3. Select colour + size + quantity
# 4. Click Buy Now → redirected to Stripe test checkout
# 5. Pay with test card 4242 4242 4242 4242
# 6. Webhook fires → order stored in D1 → Printify payload generated
# 7. Inspect at http://localhost:8788/admin
```

---

## Admin Panel

Open `http://localhost:8788/admin` and enter your `ADMIN_TOKEN`.

| Page     | URL                  | Description                            |
|----------|----------------------|----------------------------------------|
| Orders   | `/admin/orders`      | All orders with payload/response viewer |
| Products | `/admin/products`    | Cached products + sync trigger          |
| Logs     | `/admin/logs`        | Webhook, sync, and Printify logs       |

---

## Production Deployment

### 1. Create a D1 database

```bash
wrangler d1 create up-the-creek-orders
```

Copy the returned `database_id` into `wrangler.toml`.

### 2. Apply migrations to production

```bash
npm run db:migrate:remote
```

### 3. Set environment variables

In [Cloudflare Pages dashboard](https://dash.cloudflare.com) → your project → Settings → Environment Variables, set all variables from the table above using **production** values:

```
STRIPE_SECRET_KEY=sk_live_…
STRIPE_WEBHOOK_SECRET=whsec_…
PRINTIFY_MODE=dry_run        ← keep dry_run until ready
ENVIRONMENT=production
LIVE_ORDERS_ENABLED=false    ← keep false until ready
```

### 4. Deploy

```bash
npm run build
wrangler pages deploy dist
```

Or connect the repo to Cloudflare Pages for automatic deployments on push.

---

## Enabling Live Orders

When you are ready to fulfil real orders, make exactly two changes to environment variables in Cloudflare Pages:

```
PRINTIFY_MODE=live
LIVE_ORDERS_ENABLED=true
```

No code changes required. Redeploy (or trigger a re-deploy without code changes).

---

## Deployment Checklist

- [ ] D1 database created and `database_id` in `wrangler.toml`
- [ ] Migrations applied to production D1
- [ ] All environment variables set in Cloudflare Pages
- [ ] Stripe live keys configured
- [ ] Stripe webhook endpoint created for `checkout.session.completed`
- [ ] Printify API token and shop ID set
- [ ] Products synced from Printify
- [ ] `ENVIRONMENT=production` set
- [ ] `PRINTIFY_MODE=dry_run` (until ready to go live)
- [ ] `LIVE_ORDERS_ENABLED=false` (until ready to go live)
- [ ] Test checkout completed in production with test card

## Production Go-Live Checklist

- [ ] Full test purchase completed (Stripe test mode) in production
- [ ] Order appears in D1 with correct payload
- [ ] Printify payload inspected in Admin → Orders
- [ ] Switch `STRIPE_SECRET_KEY` to `sk_live_…`
- [ ] Update Stripe webhook to use live mode signing secret
- [ ] Set `PRINTIFY_MODE=live`
- [ ] Set `LIVE_ORDERS_ENABLED=true`
- [ ] Redeploy
- [ ] Place a real £1 test order to verify end-to-end

---

## API Reference

### Public

| Method | Path                        | Description              |
|--------|-----------------------------|--------------------------|
| GET    | `/api/products`             | List all cached products |
| GET    | `/api/products/:id`         | Get a single product     |
| POST   | `/api/checkout`             | Create Stripe session    |
| POST   | `/api/webhooks/stripe`      | Stripe webhook handler   |

### Admin (requires `Authorization: Bearer <ADMIN_TOKEN>`)

| Method | Path                                  | Description                      |
|--------|---------------------------------------|----------------------------------|
| POST   | `/api/admin/sync-products`            | Sync products from Printify      |
| GET    | `/api/admin/orders`                   | List orders                      |
| GET    | `/api/admin/orders?id=<id>`           | Get single order                 |
| GET    | `/api/admin/products`                 | List cached products             |
| GET    | `/api/admin/logs`                     | Get all logs                     |
| POST   | `/api/admin/test-printify-payload`    | Generate Printify payload only   |
| POST   | `/api/admin/test-order-handoff`       | Fake paid order through pipeline |
