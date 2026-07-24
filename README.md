# SKU Pulse

SKU Pulse is a SKU-level commercial visibility dashboard for the PostgreSQL
sales product-mix engine. It combines recommendation exposure, evaluated
acceptance, whitespace capture, observed buyer penetration, processed invoice
sell-in, and regional comparisons.

The current interface uses a transparent deterministic demo snapshot. It
validates the workflow and metric contract, but it is not live commercial
reporting until the PostgreSQL source, outcome linkage, market denominator, and
access controls are connected and validated.

## Dashboard workspaces

- Portfolio overview
- SKU 360
- Whitespace and penetration
- Regional performance
- Model and data health

Shared filters support region, category, SKU search, and minimum evaluated
sample size. Date and line-type controls remain locked because the demo does not
contain a faithful fact-level implementation for those dimensions.

## Metric rules

- **Exact:** an evaluated recommendation outcome with governed linkage.
- **Proxy:** observed post-launch behavior from the partial processed-invoice
  feedback feed.
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

Before enabling live decision use, connect the governed PostgreSQL data service,
configure environment variables in Netlify, enforce user and regional
entitlements, and complete source-to-dashboard reconciliation.
