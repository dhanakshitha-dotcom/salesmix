# SKU Pulse

SKU Pulse is a SKU-level commercial visibility dashboard for the PostgreSQL
sales product-mix engine. It combines recommendation exposure, evaluated
acceptance, whitespace capture, observed buyer penetration, processed invoice
sell-in, and regional comparisons.

The production interface reads PostgreSQL through the n8n Dashboard Data API.
Sales-app feedback is linked by customer, cart, recommendation, invoice and SKU,
so evaluated acceptance, target attainment, whitespace capture and recorded
removal reasons now populate automatically. Unsupported measures remain blank;
the application never substitutes mock values.

## Dashboard workspaces

- Portfolio overview
- SKU 360
- Whitespace and penetration
- Regional performance
- Model and data health
- Sales Head decision view
- Sales Agent decision view
- R&D decision view
- Finance decision view

Shared filters support live territory, valuation-area and SKU search. Date,
category and line-type controls remain locked until their governed source
dimensions are available.

## Metric rules

- **Exact:** an evaluated recommendation outcome with governed linkage.
- **Proxy:** observed buyer penetration and whitespace inside the active
  direct-dealer customer set.
- **Unavailable:** unsupported by current sources. True local-market
  penetration and sell-through need external denominator and downstream-sales
  data.
- Pending recommendations never enter acceptance or whitespace-capture
  denominators.

## PostgreSQL integration

[`sql/analytics_marts.sql`](sql/analytics_marts.sql) creates the isolated
`sales_analytics` schema with conformed dimensions, recommendation and outcome
facts, SKU marts, metric definitions, data-quality checks, indexes, and refresh
ordering.

[`POSTGRES_INTEGRATION.md`](POSTGRES_INTEGRATION.md) documents the expected
source fields, deployment order, validation checks, and production data gates.
The web application does not use SQLite or Cloudflare D1.

## Local development

Node.js 22 is required.

```bash
pnpm install
pnpm dev
```

Verify the production build:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Deploy to Netlify

1. In Netlify, choose **Add new project** and import this GitHub repository.
2. Netlify will read `netlify.toml`.
3. Confirm the production branch and select **Deploy**.

The configured build command is `pnpm build`, the publish directory is
`.next`, and Node.js 22 is selected. Netlify applies its maintained Next.js
adapter automatically.

Netlify requires `N8N_SKU_VISIBILITY_WEBHOOK_URL`. The current production data
path is sales app → n8n Learning Service → PostgreSQL → n8n Dashboard Data API →
Netlify. Before wider internal rollout, add authentication and regional
entitlements and complete the remaining product-UOM, currency and outlet-universe
source integrations shown in Data Health.
