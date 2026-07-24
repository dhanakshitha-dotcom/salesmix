# PostgreSQL integration

This dashboard uses an isolated `sales_analytics` schema over the existing
`sales_intelligence` operational engine. The implementation is in
[`sql/analytics_marts.sql`](sql/analytics_marts.sql). It does not rebuild the
engine, change recommendation logic, or write to operational transactions.

## What was validated from the saved workflows

The saved PostgreSQL workflows establish these contracts:

- `customer_product_model` is current-state, one upserted row per customer.
  `familiar_products` and `whitespace_products` are JSON arrays, and
  `source_model_version`, `area`, and `cluster_id` are overwritten on refresh.
- `recommendation_carts.cart_json` is an array of recommendation lines with
  `productId`, `category`, `lineType`, `orderUnitNos`, `unitValue`,
  `totalValue`, and `allocatedTargetValue`.
- The operational learning service validates feedback on exact
  `customer_id + cart_id + rec_id`, then persists the linked invoice,
  invoice lines, and `invoice_performance`.
- Invoice lines can repeat a SKU on separate line numbers. They must be
  aggregated by invoice and SKU for a recommendation-line result.
- The only new-whitespace class is `WHITESPACE_TRIAL`. `GRADUATED` means the
  category was captured earlier and must not inflate trial-capture rates.
- The feedback workflow accepts only positive invoice lines. The saved feed is
  therefore processed-feedback sell-in and has no return/reversal model.
- `model_runs` is written for each validation/batch event. It is not yet one
  governed logical model-build row.

No live PostgreSQL DDL, rows, row counts, indexes, model execution history, or
ERP coverage denominator was supplied. The export was saved on 2026-07-22; the
PostgreSQL recommendation, learning, and analytics workflows were inactive
staging workflows at that time.

## Live-DDL gate

The SQL starts with a fail-fast `information_schema` check. Most required
columns are directly evidenced by workflow reads/writes. The rich
`product_master` mapping is only inferred from the BA specification because the
saved workflows query that table only for `active` row count.

Before deployment, compare the live product-master DDL with these inferred
names:

`product_id`, `product_name`, `category`, `sales_order_unit`, `unit_value`,
`gross_margin_pct`, `price_effective_date`, `active`.

The analytics dimension intentionally aliases these source fields to the
reporting names `sales_order_uom`, `gp_pct`, and `price_effective_at`.

If names differ, change the `dim_product` mapping and the preflight list in the
analytics script. Do not alter the operational product master to make the
script pass.

## Analytics objects and grain

| Object | Grain | Important behavior |
|---|---|---|
| `dim_product` | Current SKU | Unions product master with every observed model/cart/invoice SKU; unknown SKUs remain visible |
| `dim_customer_current` | Current customer | Area/cluster/model are explicitly current-state proxies |
| `dim_region` | Current area label | Interim filter key, not a governed geography hierarchy |
| `dim_model_run` | Inferred logical `model_version` | Consolidates batch events; source-window/builder metadata remains null and flagged |
| `bridge_customer_familiar_sku` | Model version + customer + SKU | Expanded retained top-8 familiar proxy |
| `bridge_customer_whitespace_seed` | Model version + customer + category + seed SKU | Expanded selected-seed opportunity proxy |
| `fact_recommendation_line` | Customer + cart + rec + SKU | Duplicate SKU lines are summed once; conflicting line types are quarantined |
| `fact_invoice_line` | Invoice + line number | Keeps source line grain and duplicate/conflict flags |
| `fact_recommendation_line_outcome` | Customer + cart + rec + SKU | Requires exactly one linked performance invoice for a valid result |
| `fact_cart_action` | Action ID | Retains reasons; rejection/removal taxonomy is marked unvalidated |
| `mart_sku_region_opportunity_current` | Current region + cluster + SKU | Familiar/whitespace proxy numerators and denominators |
| `mart_sku_region_day` | Date + current region + current cluster + SKU | Indexed additive recommendation and processed sell-in measures |
| `metric_definition` | Metric | Formula, denominator, basis, availability, guardrail |
| `data_quality_health` | Health rule | Error/warn/info counts and remediation |

The materialized views have unique indexes for concurrent refresh and lookup
indexes for date, region, SKU, customer, status, and line type. Candidate
indexes on operational sources are listed but intentionally commented out; the
DBA must compare them with `pg_indexes` and query plans first.

## Metric rules implemented

- Recommendation exposure is one deduplicated
  `customer_id + cart_id + rec_id + product_id` key. Duplicate cart lines sum
  units/value but count once.
- Evaluation coverage is valid evaluated exposures divided by exposures that
  are evaluated or past `expires_at`. A cart still inside its feedback window is
  pending, not rejected.
- Acceptance is positive value for that SKU on the one exact linked invoice.
  An un-recommended SKU on the invoice remains processed sales but never
  recommendation acceptance.
- SKU value attainment is:

  `100 × sum(positive matched actual value) / sum(evaluated recommended value)`

  A non-positive denominator returns null. Values above 100% are preserved.
- Whitespace capture is:

  `100 × captured evaluated WHITESPACE_TRIAL keys / valid evaluated WHITESPACE_TRIAL keys`

  It is a ratio of sums and excludes `GRADUATED`.
- Unit attainment is deliberately null until line-level UOM and conversion are
  persisted. Product-master UOM alone cannot prove both line quantities are
  comparable.
- Processed invoice sales includes positive `POSTED` feedback invoice lines. It
  is labelled `PROCESSED_FEEDBACK_SELL_IN_ONLY`.
- Daily distinct buyers/customers are non-additive across dates. For an
  arbitrary period, calculate `count(distinct customer_id)` from the fact, not
  by summing daily values.

The known `targetOrderValue` bug is retained as a quality flag rather than
silently repaired. The request normalizer converts a missing target to numeric
zero; the downstream numeric helper treats zero as valid, so the intended
policy/customer-average fallback is bypassed and the enforced target becomes
1. Analytics marks a target of 1 under historical fallback pricing as a
suspect signature. This is a heuristic because a genuine order target of 1 is
possible. Target-dependent KPIs should not be approved for production until
the engine behavior is fixed or formally accepted.

## Region and model snapshot limitation

The operational recommendation row does not store issue-time area, cluster, or
model version. Historical facts therefore expose null recommendation-time
snapshot fields and use the current customer model only as
`reporting_region_key`. Every such row is labelled:

`CURRENT_CUSTOMER_MODEL_PROXY; RECOMMENDATION SNAPSHOT NOT STORED`

This is adequate for an interim region filter but not for immutable historical
reporting. Production should persist region ID, cluster ID, model-run ID,
model version, model-window dates, recommendation mode, pricing basis,
category/category source, and UOM snapshot when a cart is issued. A governed
SCD2 customer/territory join is an acceptable alternative.

## Deployment and refresh

Use a migration owner that can create objects in `sales_analytics` and read
`sales_intelligence`.

```sql
\set ON_ERROR_STOP on
\i sql/analytics_marts.sql
```

The script creates initial materializations with data. Refresh dependencies in
this order:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY sales_analytics.bridge_customer_familiar_sku;
REFRESH MATERIALIZED VIEW CONCURRENTLY sales_analytics.bridge_customer_whitespace_seed;
REFRESH MATERIALIZED VIEW CONCURRENTLY sales_analytics.fact_recommendation_line;
REFRESH MATERIALIZED VIEW CONCURRENTLY sales_analytics.fact_invoice_line;
REFRESH MATERIALIZED VIEW CONCURRENTLY sales_analytics.fact_recommendation_line_outcome;
REFRESH MATERIALIZED VIEW CONCURRENTLY sales_analytics.mart_sku_region_day;
```

Run each concurrent refresh outside an explicit transaction. Refresh the two
facts, outcome, and daily mart within 15 minutes of committed feedback. Refresh
all objects after a model upload. Because the operational model overwrites by
customer, refresh or snapshot the old bridges before replacement if model
history is required.

For a definition change, deploy the changed `vw_*_source` view first and
refresh its materialization. A column/type change requires a versioned
materialized-view migration; `CREATE MATERIALIZED VIEW IF NOT EXISTS` will not
rewrite an existing materialized-view signature.

Grant the dashboard a read-only role on curated objects only:

```sql
GRANT USAGE ON SCHEMA sales_analytics TO sku_dashboard_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA sales_analytics TO sku_dashboard_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA sales_analytics
  GRANT SELECT ON TABLES TO sku_dashboard_reader;
```

Row-level entitlements are not in the source. Add an identity-to-region,
customer, agent, and product/category entitlement mapping before production;
do not expose the analytics schema anonymously.

## Reconciliation and release gate

Before dashboard sign-off:

1. Run `SELECT * FROM sales_analytics.data_quality_health` and resolve every
   `ERROR` or formally accept it.
2. Reconcile at least 20 carts, 20 invoices, and 10 SKUs across two regions.
   Include duplicate-cart-SKU and duplicate-invoice-SKU cases.
3. Confirm pending recommendations do not enter the acceptance denominator.
4. Confirm linked actual value can exceed recommended value without capping.
5. Reconcile portfolio whitespace capture as captured trial keys divided by
   evaluated trial keys, not the mean of invoice capture percentages.
6. Quantify processed feedback against authoritative ERP invoice/customer
   totals before describing the sales view as complete.
7. Add recommendation-time snapshots and role entitlements.
8. Fix or accept the target-order fallback bug.

## Explicitly unavailable

Full model-window SKU penetration needs a persisted complete
customer-SKU baseline with model-window dates. Addressable local-market
penetration additionally needs an authoritative outlet universe and governed
region/channel mapping. True sell-through needs inventory availability or
receipts plus downstream POS (including transfers, returns, and closing stock).

Until those are integrated, the UI must use the basis labels exposed by
`metric_definition` and must not relabel the current familiar/seed proxies as
full penetration or processed invoice sell-in as sell-through.
