/*
 * SKU Visibility Platform - PostgreSQL analytics layer
 *
 * Governing specification: ../../BA_REQUIREMENTS.md
 * Operational schema:      sales_intelligence (read only to this layer)
 * Analytics schema:        sales_analytics
 *
 * PostgreSQL only. This script intentionally does not create or alter operational
 * tables. The source DDL was not included in the workflow export, so deployment
 * starts with a fail-fast contract check. Adjust the product_master mappings only
 * after comparing them with the live DDL; do not "fix" the operational engine here.
 *
 * Recommended deployment:
 *   1. Run the preflight section against a masked/live-equivalent database.
 *   2. Run the complete script with a schema-owner role.
 *   3. Grant dashboard roles SELECT on sales_analytics only.
 *   4. Use the refresh order documented at the end of this file.
 */

CREATE SCHEMA IF NOT EXISTS sales_analytics;

COMMENT ON SCHEMA sales_analytics IS
  'Read-only SKU recommendation, whitespace, and processed-feedback sales analytics. Does not replace the operational engine.';

/* -------------------------------------------------------------------------- */
/* 1. Fail-fast source contract validation                                    */
/* -------------------------------------------------------------------------- */

DO $contract$
DECLARE
  missing_relations text[];
  missing_columns text[];
  r record;
BEGIN
  SELECT array_agg(x.relation_name ORDER BY x.relation_name)
    INTO missing_relations
  FROM (
    VALUES
      ('sales_intelligence.customer_product_model'),
      ('sales_intelligence.product_master'),
      ('sales_intelligence.recommendation_carts'),
      ('sales_intelligence.sales_invoices'),
      ('sales_intelligence.sales_invoice_lines'),
      ('sales_intelligence.invoice_performance'),
      ('sales_intelligence.cart_line_actions'),
      ('sales_intelligence.model_runs'),
      ('sales_intelligence.service_event_log')
  ) AS x(relation_name)
  WHERE to_regclass(x.relation_name) IS NULL;

  IF cardinality(missing_relations) > 0 THEN
    RAISE EXCEPTION
      'SKU analytics deployment stopped. Missing source relations: %',
      array_to_string(missing_relations, ', ');
  END IF;

  /*
   * Columns used by saved PostgreSQL workflows are a verified inference.
   * product_master attributes other than active are an unverified inference from
   * the BA spec because the workflow only counts active rows. Failure here is a
   * deliberate live-DDL mapping gate, not a request to alter product_master.
   */
  FOR r IN
    SELECT *
    FROM (
      VALUES
        ('customer_product_model','customer_id'),
        ('customer_product_model','area'),
        ('customer_product_model','cluster_id'),
        ('customer_product_model','segment'),
        ('customer_product_model','avg_order_value'),
        ('customer_product_model','familiar_products'),
        ('customer_product_model','whitespace_products'),
        ('customer_product_model','source_model_version'),
        ('customer_product_model','model_updated_at'),
        ('customer_product_model','active'),

        ('product_master','product_id'),
        ('product_master','product_name'),
        ('product_master','category'),
        ('product_master','sales_order_unit'),
        ('product_master','unit_value'),
        ('product_master','gross_margin_pct'),
        ('product_master','price_effective_date'),
        ('product_master','active'),

        ('recommendation_carts','cart_id'),
        ('recommendation_carts','rec_id'),
        ('recommendation_carts','customer_id'),
        ('recommendation_carts','sales_agent_id'),
        ('recommendation_carts','issued_at'),
        ('recommendation_carts','expires_at'),
        ('recommendation_carts','target_order_value'),
        ('recommendation_carts','planned_mix_value'),
        ('recommendation_carts','push_level'),
        ('recommendation_carts','whitespace_share_pct'),
        ('recommendation_carts','cart_json'),
        ('recommendation_carts','source_invoice_id'),
        ('recommendation_carts','status'),

        ('sales_invoices','invoice_id'),
        ('sales_invoices','customer_id'),
        ('sales_invoices','cart_id'),
        ('sales_invoices','rec_id'),
        ('sales_invoices','sales_agent_id'),
        ('sales_invoices','invoice_date'),
        ('sales_invoices','invoice_value'),
        ('sales_invoices','status'),

        ('sales_invoice_lines','invoice_id'),
        ('sales_invoice_lines','line_no'),
        ('sales_invoice_lines','product_id'),
        ('sales_invoice_lines','product_name'),
        ('sales_invoice_lines','quantity'),
        ('sales_invoice_lines','unit_value'),
        ('sales_invoice_lines','line_value'),

        ('invoice_performance','invoice_id'),
        ('invoice_performance','cart_id'),
        ('invoice_performance','rec_id'),
        ('invoice_performance','customer_id'),
        ('invoice_performance','evaluated_at'),
        ('invoice_performance','adherence_pct'),
        ('invoice_performance','target_attainment_pct'),
        ('invoice_performance','verdict'),

        ('cart_line_actions','action_id'),
        ('cart_line_actions','cart_id'),
        ('cart_line_actions','rec_id'),
        ('cart_line_actions','customer_id'),
        ('cart_line_actions','sales_agent_id'),
        ('cart_line_actions','product_id'),
        ('cart_line_actions','recommended_units'),
        ('cart_line_actions','final_units'),
        ('cart_line_actions','recommended_value'),
        ('cart_line_actions','final_value'),
        ('cart_line_actions','action_type'),
        ('cart_line_actions','reason_code'),
        ('cart_line_actions','reason_note'),
        ('cart_line_actions','created_at'),

        ('model_runs','model_run_id'),
        ('model_runs','model_version'),
        ('model_runs','source_file'),
        ('model_runs','customer_count'),
        ('model_runs','completed_at'),
        ('model_runs','status'),
        ('model_runs','validation_json'),

        ('service_event_log','event_key'),
        ('service_event_log','event_type'),
        ('service_event_log','cart_id'),
        ('service_event_log','rec_id'),
        ('service_event_log','payload_json')
    ) AS required(table_name, column_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'sales_intelligence'
        AND c.table_name = r.table_name
        AND c.column_name = r.column_name
    ) THEN
      missing_columns :=
        array_append(missing_columns, r.table_name || '.' || r.column_name);
    END IF;
  END LOOP;

  IF cardinality(missing_columns) > 0 THEN
    RAISE EXCEPTION
      'SKU analytics deployment stopped. Missing/incompatible inferred columns: %. Validate live DDL and update analytics mappings only.',
      array_to_string(missing_columns, ', ');
  END IF;
END
$contract$;

/* Safe JSON helpers: malformed optional numerics become visible nulls, not zero. */
CREATE OR REPLACE FUNCTION sales_analytics.safe_numeric(p_text text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $function$
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN NULL;
  END IF;
  RETURN p_text::numeric;
EXCEPTION
  WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN NULL;
END
$function$;

CREATE OR REPLACE FUNCTION sales_analytics.jsonb_array_or_empty(p_json jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $function$
  SELECT CASE
    WHEN jsonb_typeof(p_json) = 'array' THEN p_json
    ELSE '[]'::jsonb
  END
$function$;

/* -------------------------------------------------------------------------- */
/* 2. Current dimensions and logical model-run consolidation                  */
/* -------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW sales_analytics.dim_customer_current AS
SELECT
  m.customer_id,
  NULLIF(btrim(m.area), '') AS area_label,
  COALESCE(NULLIF(btrim(m.area), ''), '__UNKNOWN_REGION__') AS reporting_region_key,
  'CURRENT_AREA_LABEL_INTERIM_NOT_GOVERNED_REGION_ID'::text AS region_key_basis,
  NULLIF(btrim(m.cluster_id), '') AS cluster_id,
  NULLIF(btrim(m.segment), '') AS segment,
  m.avg_order_value,
  NULLIF(btrim(m.source_model_version), '') AS current_model_version,
  m.model_updated_at,
  m.active,
  jsonb_array_length(
    sales_analytics.jsonb_array_or_empty(m.familiar_products)
  ) AS familiar_entry_count,
  jsonb_array_length(
    sales_analytics.jsonb_array_or_empty(m.whitespace_products)
  ) AS whitespace_category_count,
  'CURRENT_ONLY; SOURCE UPSERT OVERWRITES BY CUSTOMER_ID'::text AS history_basis
FROM sales_intelligence.customer_product_model m;

COMMENT ON VIEW sales_analytics.dim_customer_current IS
  'Current customer-model row only. Area/cluster/model are not historical recommendation-time snapshots.';

CREATE OR REPLACE VIEW sales_analytics.dim_region AS
SELECT
  reporting_region_key AS region_id,
  max(area_label) AS region_name,
  count(*) FILTER (WHERE active) AS active_modeled_customer_count,
  'INTERIM_AREA_LABEL; GOVERNED REGION HIERARCHY REQUIRED'::text AS region_basis
FROM sales_analytics.dim_customer_current
GROUP BY reporting_region_key;

CREATE OR REPLACE VIEW sales_analytics.dim_model_run AS
WITH normalized AS (
  SELECT
    mr.model_run_id,
    NULLIF(btrim(mr.model_version), '') AS model_version,
    mr.source_file,
    mr.customer_count,
    mr.completed_at,
    mr.status,
    mr.validation_json,
    sales_analytics.safe_numeric(
      mr.validation_json ->> 'batch_number'
    )::integer AS batch_number,
    sales_analytics.safe_numeric(
      mr.validation_json ->> 'batch_count'
    )::integer AS declared_batch_count,
    sales_analytics.safe_numeric(
      mr.validation_json ->> 'expected_customer_count'
    )::bigint AS expected_customer_count
  FROM sales_intelligence.model_runs mr
),
grouped AS (
  SELECT
    COALESCE(model_version, '__MISSING_MODEL_VERSION__') AS logical_model_run_id,
    model_version,
    min(completed_at) AS first_batch_completed_at,
    max(completed_at) AS logical_completed_at,
    max(customer_count) AS max_loaded_customer_count,
    max(expected_customer_count) AS expected_customer_count,
    max(declared_batch_count) AS declared_batch_count,
    count(DISTINCT batch_number) FILTER (WHERE batch_number IS NOT NULL)
      AS distinct_batch_numbers_seen,
    count(*) AS validation_event_count,
    array_agg(DISTINCT status ORDER BY status) AS batch_statuses,
    bool_or(status = 'VALIDATION_FAILED') AS has_validation_failure,
    bool_or(status = 'COMPLETED') AS has_completed_event,
    max(model_run_id) AS latest_batch_model_run_id
  FROM normalized
  GROUP BY COALESCE(model_version, '__MISSING_MODEL_VERSION__'), model_version
)
SELECT
  logical_model_run_id,
  model_version,
  first_batch_completed_at,
  logical_completed_at,
  max_loaded_customer_count,
  expected_customer_count,
  declared_batch_count,
  distinct_batch_numbers_seen,
  validation_event_count,
  batch_statuses,
  latest_batch_model_run_id,
  CASE
    WHEN has_validation_failure THEN 'VALIDATION_FAILED'
    WHEN has_completed_event
      AND (
        declared_batch_count IS NULL
        OR distinct_batch_numbers_seen >= declared_batch_count
      )
      AND (
        expected_customer_count IS NULL
        OR max_loaded_customer_count = expected_customer_count
      )
      THEN 'COMPLETED'
    ELSE 'PARTIAL_OR_UNPROVEN'
  END AS logical_status,
  NULL::date AS model_window_start,
  NULL::date AS model_window_end,
  NULL::text AS model_builder_version,
  NULL::text AS model_builder_checksum,
  array_remove(ARRAY[
    'MODEL_WINDOW_START_END_NOT_STORED',
    'BUILDER_VERSION_NOT_STORED',
    'BUILDER_CHECKSUM_NOT_STORED',
    CASE
      WHEN validation_event_count > COALESCE(declared_batch_count, 1)
      THEN 'REPEATED_OR_OUT_OF_ORDER_BATCH_EVENTS_POSSIBLE'
    END
  ], NULL) AS metadata_gaps
FROM grouped;

COMMENT ON VIEW sales_analytics.dim_model_run IS
  'One inferred logical row per model_version. Operational model_runs contains per-batch validation events, not a governed logical build.';

/*
 * dim_product uses the BA-inferred product_master names validated above.
 * Unknown products from models/carts/invoices are retained instead of dropped.
 */
CREATE OR REPLACE VIEW sales_analytics.dim_product AS
WITH familiar AS (
  SELECT
    NULLIF(btrim(f.value ->> 'sku'), '') AS product_id,
    NULLIF(btrim(f.value ->> 'd'), '') AS product_name,
    NULLIF(btrim(f.value ->> 'cat'), '') AS category
  FROM sales_intelligence.customer_product_model m
  CROSS JOIN LATERAL jsonb_array_elements(
    sales_analytics.jsonb_array_or_empty(m.familiar_products)
  ) f(value)
),
whitespace AS (
  SELECT
    NULLIF(btrim(s.value ->> 'sku'), '') AS product_id,
    NULLIF(btrim(s.value ->> 'd'), '') AS product_name,
    NULLIF(btrim(w.value ->> 'cat'), '') AS category
  FROM sales_intelligence.customer_product_model m
  CROSS JOIN LATERAL jsonb_array_elements(
    sales_analytics.jsonb_array_or_empty(m.whitespace_products)
  ) w(value)
  CROSS JOIN LATERAL jsonb_array_elements(
    sales_analytics.jsonb_array_or_empty(w.value -> 'seeds')
  ) s(value)
),
recommendations AS (
  SELECT
    NULLIF(btrim(j.value ->> 'productId'), '') AS product_id,
    NULLIF(btrim(j.value ->> 'productName'), '') AS product_name,
    NULLIF(btrim(j.value ->> 'category'), '') AS category
  FROM sales_intelligence.recommendation_carts r
  CROSS JOIN LATERAL jsonb_array_elements(
    sales_analytics.jsonb_array_or_empty(r.cart_json)
  ) j(value)
),
invoices AS (
  SELECT
    NULLIF(btrim(l.product_id), '') AS product_id,
    NULLIF(btrim(l.product_name), '') AS product_name,
    NULL::text AS category
  FROM sales_intelligence.sales_invoice_lines l
),
observed AS (
  SELECT
    product_id,
    max(product_name) FILTER (WHERE product_name IS NOT NULL) AS observed_name,
    max(category) FILTER (WHERE category IS NOT NULL) AS observed_category
  FROM (
    SELECT * FROM familiar
    UNION ALL SELECT * FROM whitespace
    UNION ALL SELECT * FROM recommendations
    UNION ALL SELECT * FROM invoices
  ) x
  WHERE product_id IS NOT NULL
  GROUP BY product_id
),
master AS (
  SELECT
    NULLIF(btrim(pm.product_id), '') AS product_id,
    max(NULLIF(btrim(pm.product_name), '')) AS product_name,
    max(NULLIF(btrim(pm.category), '')) AS category,
    max(NULLIF(btrim(pm.sales_order_unit), '')) AS sales_order_uom,
    max(pm.unit_value) AS current_unit_value,
    max(pm.gross_margin_pct) AS gp_pct,
    max(pm.price_effective_date) AS price_effective_at,
    bool_or(pm.active) AS active,
    count(*) AS master_row_count
  FROM sales_intelligence.product_master pm
  WHERE NULLIF(btrim(pm.product_id), '') IS NOT NULL
  GROUP BY NULLIF(btrim(pm.product_id), '')
),
all_product_ids AS (
  SELECT product_id FROM observed
  UNION
  SELECT product_id FROM master
)
SELECT
  p.product_id,
  COALESCE(m.product_name, o.observed_name, 'Unknown product [' || p.product_id || ']')
    AS product_name,
  COALESCE(m.category, o.observed_category, 'UNKNOWN') AS category,
  CASE
    WHEN m.category IS NOT NULL THEN 'PRODUCT_MASTER_CURRENT'
    WHEN o.observed_category IS NOT NULL THEN 'MODEL_OR_RECOMMENDATION_HEURISTIC'
    ELSE 'UNKNOWN'
  END AS category_source,
  m.sales_order_uom,
  m.current_unit_value,
  m.gp_pct,
  m.price_effective_at,
  COALESCE(m.active, false) AS active,
  (m.product_id IS NOT NULL) AS is_known_product,
  COALESCE(m.master_row_count, 0) AS master_row_count,
  CASE
    WHEN m.product_id IS NULL THEN 'UNKNOWN_PRODUCT_RETAINED'
    WHEN m.master_row_count > 1 THEN 'DUPLICATE_PRODUCT_MASTER_ROWS'
    ELSE 'MASTERED'
  END AS product_record_status
FROM all_product_ids p
LEFT JOIN master m USING (product_id)
LEFT JOIN observed o USING (product_id);

/* -------------------------------------------------------------------------- */
/* 3. Expanded current-model bridges                                          */
/* -------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW sales_analytics.vw_bridge_customer_familiar_sku_source AS
WITH raw AS (
  SELECT
    COALESCE(NULLIF(btrim(m.source_model_version), ''), '__MISSING_MODEL_VERSION__')
      AS model_version,
    m.customer_id,
    COALESCE(NULLIF(btrim(m.area), ''), '__UNKNOWN_REGION__')
      AS reporting_region_key,
    COALESCE(NULLIF(btrim(m.cluster_id), ''), '__UNKNOWN_CLUSTER__')
      AS cluster_key,
    f.ordinality::integer AS familiar_rank,
    COALESCE(
      NULLIF(btrim(f.value ->> 'sku'), ''),
      '__MISSING_PRODUCT__'
    ) AS product_id,
    NULLIF(btrim(f.value ->> 'd'), '') AS model_product_name,
    NULLIF(btrim(f.value ->> 'cat'), '') AS model_category,
    sales_analytics.safe_numeric(f.value ->> 'uv') AS historical_unit_value,
    sales_analytics.safe_numeric(f.value ->> 'gp') AS historical_gp_pct,
    sales_analytics.safe_numeric(f.value ->> 'w') AS familiar_value_weight,
    sales_analytics.safe_numeric(f.value ->> 'tq') AS typical_quantity,
    m.model_updated_at
  FROM sales_intelligence.customer_product_model m
  CROSS JOIN LATERAL jsonb_array_elements(
    sales_analytics.jsonb_array_or_empty(m.familiar_products)
  ) WITH ORDINALITY f(value, ordinality)
  WHERE m.active
)
SELECT
  model_version,
  customer_id,
  product_id,
  min(reporting_region_key) AS reporting_region_key,
  min(cluster_key) AS cluster_key,
  min(familiar_rank) AS familiar_rank,
  max(model_product_name) AS model_product_name,
  max(model_category) AS model_category,
  max(historical_unit_value) AS historical_unit_value,
  max(historical_gp_pct) AS historical_gp_pct,
  max(familiar_value_weight) AS familiar_value_weight,
  max(typical_quantity) AS typical_quantity,
  max(model_updated_at) AS model_updated_at,
  count(*)::integer AS source_entry_count,
  (count(*) > 1) AS duplicate_model_entry_flag,
  NULL::date AS model_window_start,
  NULL::date AS model_window_end,
  'TOP_8_FAMILIAR_PROXY; CURRENT MODEL ONLY'::text AS metric_basis
FROM raw
GROUP BY model_version, customer_id, product_id;

CREATE MATERIALIZED VIEW IF NOT EXISTS
  sales_analytics.bridge_customer_familiar_sku
AS
SELECT * FROM sales_analytics.vw_bridge_customer_familiar_sku_source
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_bridge_familiar_grain
  ON sales_analytics.bridge_customer_familiar_sku
  (model_version, customer_id, product_id);
CREATE INDEX IF NOT EXISTS ix_bridge_familiar_region_product
  ON sales_analytics.bridge_customer_familiar_sku
  (reporting_region_key, cluster_key, product_id);

CREATE OR REPLACE VIEW
  sales_analytics.vw_bridge_customer_whitespace_seed_source
AS
WITH raw AS (
  SELECT
    COALESCE(NULLIF(btrim(m.source_model_version), ''), '__MISSING_MODEL_VERSION__')
      AS model_version,
    m.customer_id,
    COALESCE(NULLIF(btrim(m.area), ''), '__UNKNOWN_REGION__')
      AS reporting_region_key,
    COALESCE(NULLIF(btrim(m.cluster_id), ''), '__UNKNOWN_CLUSTER__')
      AS cluster_key,
    w.ordinality::integer AS whitespace_category_rank,
    COALESCE(
      NULLIF(btrim(w.value ->> 'cat'), ''),
      '__UNKNOWN_CATEGORY__'
    ) AS whitespace_category,
    sales_analytics.safe_numeric(w.value ->> 'score') AS category_score,
    sales_analytics.safe_numeric(w.value ->> 'peer') AS peer_penetration_pct,
    s.ordinality::integer AS seed_rank,
    COALESCE(
      NULLIF(btrim(s.value ->> 'sku'), ''),
      '__MISSING_PRODUCT__'
    ) AS product_id,
    NULLIF(btrim(s.value ->> 'd'), '') AS model_product_name,
    sales_analytics.safe_numeric(s.value ->> 'uv') AS historical_unit_value,
    sales_analytics.safe_numeric(s.value ->> 'mq') AS median_quantity,
    sales_analytics.safe_numeric(s.value ->> 'gp') AS historical_gp_pct,
    m.model_updated_at
  FROM sales_intelligence.customer_product_model m
  CROSS JOIN LATERAL jsonb_array_elements(
    sales_analytics.jsonb_array_or_empty(m.whitespace_products)
  ) WITH ORDINALITY w(value, ordinality)
  CROSS JOIN LATERAL jsonb_array_elements(
    sales_analytics.jsonb_array_or_empty(w.value -> 'seeds')
  ) WITH ORDINALITY s(value, ordinality)
  WHERE m.active
)
SELECT
  model_version,
  customer_id,
  whitespace_category,
  product_id,
  min(reporting_region_key) AS reporting_region_key,
  min(cluster_key) AS cluster_key,
  min(whitespace_category_rank) AS whitespace_category_rank,
  max(category_score) AS category_score,
  max(peer_penetration_pct) AS peer_penetration_pct,
  min(seed_rank) AS seed_rank,
  max(model_product_name) AS model_product_name,
  max(historical_unit_value) AS historical_unit_value,
  max(median_quantity) AS median_quantity,
  max(historical_gp_pct) AS historical_gp_pct,
  max(model_updated_at) AS model_updated_at,
  count(*)::integer AS source_entry_count,
  (count(*) > 1) AS duplicate_model_entry_flag,
  NULL::date AS model_window_start,
  NULL::date AS model_window_end,
  'STORED_SELECTED_WHITESPACE_SEED_PROXY; NOT EXHAUSTIVE OPPORTUNITY'
    AS metric_basis
FROM raw
GROUP BY model_version, customer_id, whitespace_category, product_id;

CREATE MATERIALIZED VIEW IF NOT EXISTS
  sales_analytics.bridge_customer_whitespace_seed
AS
SELECT * FROM sales_analytics.vw_bridge_customer_whitespace_seed_source
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_bridge_whitespace_grain
  ON sales_analytics.bridge_customer_whitespace_seed
  (model_version, customer_id, whitespace_category, product_id);
CREATE INDEX IF NOT EXISTS ix_bridge_whitespace_region_product
  ON sales_analytics.bridge_customer_whitespace_seed
  (reporting_region_key, cluster_key, product_id);

/* -------------------------------------------------------------------------- */
/* 4. Recommendation and invoice facts                                        */
/* -------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW sales_analytics.vw_fact_recommendation_line_source AS
WITH pricing_event AS (
  SELECT
    e.cart_id,
    e.rec_id,
    max(NULLIF(btrim(e.payload_json ->> 'pricing_status'), ''))
      AS pricing_basis
  FROM sales_intelligence.service_event_log e
  WHERE e.event_type = 'CART_ISSUED'
  GROUP BY e.cart_id, e.rec_id
),
raw AS (
  SELECT
    r.cart_id,
    r.rec_id,
    r.customer_id,
    r.sales_agent_id,
    r.issued_at,
    r.expires_at,
    r.target_order_value,
    r.planned_mix_value,
    r.push_level,
    r.whitespace_share_pct,
    r.source_invoice_id,
    r.status AS cart_status,
    COALESCE(
      NULLIF(btrim(j.value ->> 'productId'), ''),
      NULLIF(btrim(j.value ->> 'sku'), ''),
      '__MISSING_PRODUCT__'
    ) AS product_id,
    NULLIF(
      btrim(COALESCE(j.value ->> 'productName', j.value ->> 'description')),
      ''
    ) AS recommendation_product_name,
    NULLIF(btrim(j.value ->> 'category'), '') AS recommendation_category,
    upper(COALESCE(NULLIF(btrim(j.value ->> 'lineType'), ''), 'UNKNOWN'))
      AS source_line_type,
    sales_analytics.safe_numeric(j.value ->> 'orderUnitNos')
      AS recommended_units,
    sales_analytics.safe_numeric(j.value ->> 'unitValue')
      AS recommendation_unit_value,
    COALESCE(
      sales_analytics.safe_numeric(j.value ->> 'totalValue'),
      sales_analytics.safe_numeric(j.value ->> 'targetValue')
    ) AS recommended_value,
    sales_analytics.safe_numeric(j.value ->> 'allocatedTargetValue')
      AS allocated_target_value,
    NULLIF(btrim(j.value ->> 'rationale'), '') AS rationale,
    j.ordinality::integer AS source_line_ordinality,
    pe.pricing_basis
  FROM sales_intelligence.recommendation_carts r
  CROSS JOIN LATERAL jsonb_array_elements(
    sales_analytics.jsonb_array_or_empty(r.cart_json)
  ) WITH ORDINALITY j(value, ordinality)
  LEFT JOIN pricing_event pe
    ON pe.cart_id = r.cart_id
   AND pe.rec_id = r.rec_id
),
deduplicated AS (
  SELECT
    cart_id,
    rec_id,
    customer_id,
    product_id,
    min(sales_agent_id) AS sales_agent_id,
    min(issued_at) AS issued_at,
    min(expires_at) AS expires_at,
    max(target_order_value) AS cart_target_order_value,
    max(planned_mix_value) AS cart_planned_mix_value,
    max(push_level) AS push_level,
    max(whitespace_share_pct) AS whitespace_share_pct,
    min(source_invoice_id) AS source_invoice_id,
    min(cart_status) AS cart_status,
    max(recommendation_product_name) AS recommendation_product_name,
    CASE
      WHEN count(DISTINCT recommendation_category)
        FILTER (WHERE recommendation_category IS NOT NULL) <= 1
      THEN max(recommendation_category)
      ELSE NULL
    END AS recommendation_category,
    CASE
      WHEN count(DISTINCT source_line_type) = 1 THEN min(source_line_type)
      ELSE 'CONFLICTING_DUPLICATE'
    END AS line_type,
    array_agg(DISTINCT source_line_type ORDER BY source_line_type)
      AS source_line_types,
    sum(recommended_units) AS recommended_units,
    CASE
      WHEN count(*) FILTER (WHERE recommendation_unit_value IS NOT NULL) > 0
      THEN
        sum(recommended_value)
        / NULLIF(sum(recommended_units), 0)
      ELSE NULL
    END AS implied_recommendation_unit_value,
    sum(recommended_value) AS recommended_value,
    sum(allocated_target_value) AS allocated_target_value,
    string_agg(DISTINCT rationale, ' | ' ORDER BY rationale)
      FILTER (WHERE rationale IS NOT NULL) AS rationale,
    count(*)::integer AS source_line_count,
    array_agg(source_line_ordinality ORDER BY source_line_ordinality)
      AS source_line_ordinals,
    max(pricing_basis) AS pricing_basis
  FROM raw
  GROUP BY cart_id, rec_id, customer_id, product_id
)
SELECT
  d.cart_id,
  d.rec_id,
  d.customer_id,
  d.product_id,
  d.sales_agent_id,
  d.issued_at,
  d.expires_at,
  d.cart_target_order_value,
  d.cart_planned_mix_value,
  d.push_level,
  d.whitespace_share_pct,
  d.source_invoice_id,
  d.cart_status,
  d.recommendation_product_name,
  d.recommendation_category,
  d.line_type,
  d.source_line_types,
  d.recommended_units,
  d.implied_recommendation_unit_value,
  d.recommended_value,
  d.allocated_target_value,
  d.rationale,
  d.source_line_count,
  d.source_line_ordinals,
  (d.source_line_count > 1) AS duplicate_sku_line_flag,
  (d.line_type = 'CONFLICTING_DUPLICATE') AS line_type_conflict_flag,
  (d.product_id = '__MISSING_PRODUCT__') AS missing_product_id_flag,
  (d.recommended_value IS NULL OR d.recommended_value <= 0)
    AS invalid_recommended_value_flag,
  COALESCE(d.pricing_basis, 'UNKNOWN_NOT_PERSISTED') AS pricing_basis,
  (
    d.cart_target_order_value = 1
    AND COALESCE(d.pricing_basis, 'HISTORICAL_MODEL_FALLBACK')
      = 'HISTORICAL_MODEL_FALLBACK'
  ) AS suspect_target_order_value_fallback_bug,
  NULL::text AS recommendation_time_region_id,
  NULL::text AS recommendation_time_cluster_id,
  NULL::text AS recommendation_time_model_version,
  COALESCE(c.reporting_region_key, '__UNKNOWN_REGION__')
    AS reporting_region_key,
  COALESCE(c.cluster_id, '__UNKNOWN_CLUSTER__') AS reporting_cluster_key,
  c.current_model_version,
  'CURRENT_CUSTOMER_MODEL_PROXY; RECOMMENDATION SNAPSHOT NOT STORED'
    AS region_model_basis,
  COALESCE(p.is_known_product, false) AS is_known_product,
  COALESCE(p.active, false) AS product_currently_active,
  CASE
    WHEN d.cart_status = 'EVALUATED' THEN true
    WHEN d.expires_at <= clock_timestamp() THEN true
    ELSE false
  END AS evaluation_due_flag,
  CASE
    WHEN d.cart_status = 'EVALUATED' THEN 'EVALUATED'
    WHEN d.expires_at <= clock_timestamp() THEN 'EXPIRED_AWAITING_FEEDBACK'
    ELSE 'PENDING_WITHIN_FEEDBACK_WINDOW'
  END AS feedback_state
FROM deduplicated d
LEFT JOIN sales_analytics.dim_customer_current c
  ON c.customer_id = d.customer_id
LEFT JOIN sales_analytics.dim_product p
  ON p.product_id = d.product_id;

CREATE MATERIALIZED VIEW IF NOT EXISTS
  sales_analytics.fact_recommendation_line
AS
SELECT * FROM sales_analytics.vw_fact_recommendation_line_source
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_fact_recommendation_line_grain
  ON sales_analytics.fact_recommendation_line
  (customer_id, cart_id, rec_id, product_id);
CREATE INDEX IF NOT EXISTS ix_fact_recommendation_line_date_region_sku
  ON sales_analytics.fact_recommendation_line
  (issued_at, reporting_region_key, product_id);
CREATE INDEX IF NOT EXISTS ix_fact_recommendation_line_status_type
  ON sales_analytics.fact_recommendation_line
  (cart_status, feedback_state, line_type);
CREATE INDEX IF NOT EXISTS ix_fact_recommendation_line_agent
  ON sales_analytics.fact_recommendation_line
  (sales_agent_id, issued_at);

CREATE OR REPLACE VIEW sales_analytics.vw_fact_invoice_line_source AS
WITH header AS (
  SELECT
    i.invoice_id,
    min(i.customer_id) AS customer_id,
    min(i.cart_id) AS cart_id,
    min(i.rec_id) AS rec_id,
    min(i.sales_agent_id) AS sales_agent_id,
    min(i.invoice_date) AS invoice_date,
    max(i.invoice_value) AS invoice_header_value,
    min(i.status) AS invoice_status,
    count(*)::integer AS source_header_count,
    count(DISTINCT i.customer_id) > 1
      OR count(DISTINCT i.cart_id) > 1
      OR count(DISTINCT i.rec_id) > 1 AS header_key_conflict_flag
  FROM sales_intelligence.sales_invoices i
  GROUP BY i.invoice_id
),
line AS (
  SELECT
    l.invoice_id,
    l.line_no,
    COALESCE(l.line_no::text, '__MISSING_LINE_NO__') AS line_key,
    min(NULLIF(btrim(l.product_id), '')) AS product_id,
    max(NULLIF(btrim(l.product_name), '')) AS product_name,
    max(l.quantity) AS quantity,
    max(l.unit_value) AS unit_value,
    max(l.line_value) AS line_value,
    count(*)::integer AS source_line_row_count,
    count(DISTINCT NULLIF(btrim(l.product_id), '')) > 1
      AS product_id_conflict_flag
  FROM sales_intelligence.sales_invoice_lines l
  GROUP BY l.invoice_id, l.line_no
)
SELECT
  l.invoice_id,
  l.line_no,
  l.line_key,
  l.product_id,
  l.product_name,
  l.quantity,
  l.unit_value,
  l.line_value,
  h.customer_id,
  h.cart_id,
  h.rec_id,
  h.sales_agent_id,
  h.invoice_date,
  h.invoice_header_value,
  h.invoice_status,
  l.source_line_row_count,
  h.source_header_count,
  l.product_id_conflict_flag,
  h.header_key_conflict_flag,
  (h.invoice_id IS NULL) AS orphan_invoice_line_flag,
  (
    h.invoice_id IS NOT NULL
    AND h.source_header_count = 1
    AND NOT h.header_key_conflict_flag
    AND l.source_line_row_count = 1
    AND NOT l.product_id_conflict_flag
    AND l.product_id IS NOT NULL
  ) AS valid_invoice_line_flag,
  COALESCE(c.reporting_region_key, '__UNKNOWN_REGION__')
    AS reporting_region_key,
  COALESCE(c.cluster_id, '__UNKNOWN_CLUSTER__') AS reporting_cluster_key,
  'CURRENT_CUSTOMER_MODEL_PROXY; INVOICE REGION SNAPSHOT NOT STORED'
    AS region_basis,
  COALESCE(p.is_known_product, false) AS is_known_product,
  COALESCE(p.active, false) AS product_currently_active,
  (
    h.invoice_status = 'POSTED'
    AND l.line_value > 0
  ) AS positive_posted_sell_in_flag,
  'PROCESSED_FEEDBACK_SELL_IN_ONLY'::text AS sales_metric_basis
FROM line l
LEFT JOIN header h
  ON h.invoice_id = l.invoice_id
LEFT JOIN sales_analytics.dim_customer_current c
  ON c.customer_id = h.customer_id
LEFT JOIN sales_analytics.dim_product p
  ON p.product_id = l.product_id;

CREATE MATERIALIZED VIEW IF NOT EXISTS sales_analytics.fact_invoice_line
AS
SELECT * FROM sales_analytics.vw_fact_invoice_line_source
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_fact_invoice_line_grain
  ON sales_analytics.fact_invoice_line (invoice_id, line_key);
CREATE INDEX IF NOT EXISTS ix_fact_invoice_line_date_region_sku
  ON sales_analytics.fact_invoice_line
  (invoice_date, reporting_region_key, product_id);
CREATE INDEX IF NOT EXISTS ix_fact_invoice_line_customer_sku
  ON sales_analytics.fact_invoice_line
  (customer_id, product_id, invoice_date);

CREATE OR REPLACE VIEW sales_analytics.fact_cart_action AS
SELECT
  a.action_id,
  a.cart_id,
  a.rec_id,
  a.customer_id,
  a.sales_agent_id,
  a.product_id,
  a.recommended_units,
  a.final_units,
  a.recommended_value,
  a.final_value,
  NULLIF(btrim(a.action_type), '') AS action_type,
  NULLIF(btrim(a.reason_code), '') AS reason_code,
  a.reason_note,
  a.created_at,
  (
    upper(COALESCE(a.action_type, '')) IN
      ('REMOVED', 'REJECTED', 'REDUCED')
  ) AS removal_or_rejection_proxy_flag,
  'ACTION TAXONOMY MUST BE VALIDATED BEFORE RATE REPORTING'
    AS action_taxonomy_basis
FROM sales_intelligence.cart_line_actions a;

/* -------------------------------------------------------------------------- */
/* 5. Exact linked recommendation-line outcomes                               */
/* -------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW
  sales_analytics.vw_fact_recommendation_line_outcome_source
AS
WITH invoice_header AS (
  SELECT
    i.invoice_id,
    min(i.customer_id) AS customer_id,
    min(i.cart_id) AS cart_id,
    min(i.rec_id) AS rec_id,
    count(*)::integer AS header_row_count,
    (
      count(DISTINCT i.customer_id) > 1
      OR count(DISTINCT i.cart_id) > 1
      OR count(DISTINCT i.rec_id) > 1
    ) AS header_key_conflict_flag
  FROM sales_intelligence.sales_invoices i
  GROUP BY i.invoice_id
),
performance_link AS (
  SELECT
    p.customer_id,
    p.cart_id,
    p.rec_id,
    count(*)::integer AS performance_row_count,
    count(DISTINCT p.invoice_id)::integer AS linked_invoice_count,
    CASE
      WHEN count(DISTINCT p.invoice_id) = 1
        AND NOT bool_or(
          i.invoice_id IS NULL
          OR i.header_row_count <> 1
          OR i.header_key_conflict_flag
          OR i.customer_id IS DISTINCT FROM p.customer_id
          OR i.cart_id IS DISTINCT FROM p.cart_id
          OR i.rec_id IS DISTINCT FROM p.rec_id
        )
      THEN min(p.invoice_id)
      ELSE NULL
    END AS valid_linked_invoice_id,
    bool_or(
      i.invoice_id IS NULL
      OR i.header_row_count <> 1
      OR i.header_key_conflict_flag
      OR i.customer_id IS DISTINCT FROM p.customer_id
      OR i.cart_id IS DISTINCT FROM p.cart_id
      OR i.rec_id IS DISTINCT FROM p.rec_id
    ) AS invoice_header_link_mismatch_flag,
    min(p.evaluated_at) AS evaluated_at,
    max(p.adherence_pct) AS cart_adherence_pct,
    max(p.target_attainment_pct) AS engine_cart_target_attainment_pct,
    array_agg(DISTINCT p.verdict ORDER BY p.verdict) AS verdicts
  FROM sales_intelligence.invoice_performance p
  LEFT JOIN invoice_header i
    ON i.invoice_id = p.invoice_id
  GROUP BY p.customer_id, p.cart_id, p.rec_id
),
actual_by_invoice_sku AS (
  SELECT
    f.invoice_id,
    f.product_id,
    count(*)::integer AS invoice_product_line_count,
    sum(f.quantity) FILTER (
      WHERE f.valid_invoice_line_flag AND f.quantity > 0
    ) AS positive_actual_units,
    sum(f.line_value) FILTER (
      WHERE f.valid_invoice_line_flag AND f.line_value > 0
    ) AS positive_actual_value,
    max(f.invoice_date) AS invoice_date,
    max(f.invoice_status) AS invoice_status
  FROM sales_analytics.fact_invoice_line f
  GROUP BY f.invoice_id, f.product_id
)
SELECT
  r.cart_id,
  r.rec_id,
  r.customer_id,
  r.product_id,
  r.sales_agent_id,
  r.issued_at,
  r.expires_at,
  l.evaluated_at,
  a.invoice_date,
  l.valid_linked_invoice_id AS invoice_id,
  r.reporting_region_key,
  r.reporting_cluster_key,
  r.recommendation_time_region_id,
  r.recommendation_time_cluster_id,
  r.recommendation_time_model_version,
  r.current_model_version,
  r.region_model_basis,
  r.line_type,
  r.source_line_types,
  r.recommendation_category,
  r.recommended_units,
  r.recommended_value,
  COALESCE(a.positive_actual_units, 0) AS accepted_actual_units,
  COALESCE(a.positive_actual_value, 0) AS matched_actual_value,
  a.invoice_product_line_count,
  l.performance_row_count,
  l.linked_invoice_count,
  COALESCE(l.invoice_header_link_mismatch_flag, false)
    AS invoice_header_link_mismatch_flag,
  COALESCE(l.performance_row_count > 0, false) AS evaluated_flag,
  (
    COALESCE(
      l.performance_row_count = 1
      AND l.linked_invoice_count = 1,
      false
    )
    AND NOT COALESCE(l.invoice_header_link_mismatch_flag, false)
  ) AS valid_exact_link_flag,
  CASE
    WHEN l.performance_row_count IS NULL THEN false
    WHEN l.performance_row_count <> 1 OR l.linked_invoice_count <> 1 THEN false
    WHEN l.invoice_header_link_mismatch_flag THEN false
    ELSE COALESCE(a.positive_actual_value, 0) > 0
  END AS accepted_flag,
  CASE
    WHEN l.performance_row_count IS NULL
      AND r.expires_at > clock_timestamp()
      THEN 'AWAITING_FEEDBACK'
    WHEN l.performance_row_count IS NULL
      THEN 'EXPIRED_AWAITING_FEEDBACK'
    WHEN l.performance_row_count <> 1
      OR l.linked_invoice_count <> 1
      OR l.invoice_header_link_mismatch_flag
      THEN 'DATA_QUALITY_HOLD'
    WHEN COALESCE(a.positive_actual_value, 0) > 0
      THEN 'ACCEPTED'
    ELSE 'NOT_ACCEPTED'
  END AS outcome_status,
  CASE
    WHEN l.performance_row_count = 1
      AND l.linked_invoice_count = 1
      AND NOT l.invoice_header_link_mismatch_flag
      AND r.recommended_value > 0
    THEN round(
      100 * COALESCE(a.positive_actual_value, 0) / r.recommended_value,
      2
    )
    ELSE NULL
  END AS sku_value_attainment_pct,
  /*
   * The workflow does not persist invoice/recommendation line UOM.
   * A raw unit ratio would look exact but may compare incompatible units.
   */
  NULL::numeric AS sku_unit_attainment_pct,
  'UNAVAILABLE_UNTIL_LINE_UOM_AND_CONVERSION_ARE_PERSISTED'
    AS unit_attainment_basis,
  (r.line_type = 'WHITESPACE_TRIAL') AS whitespace_trial_flag,
  (
    r.line_type = 'WHITESPACE_TRIAL'
    AND l.performance_row_count = 1
    AND l.linked_invoice_count = 1
    AND NOT l.invoice_header_link_mismatch_flag
    AND COALESCE(a.positive_actual_value, 0) > 0
  ) AS whitespace_captured_flag,
  (r.line_type = 'GRADUATED') AS graduated_flag,
  /*
   * GRADUATED is deliberately excluded from whitespace capture. Category-level
   * graduation never implies this SKU was itself accepted in an earlier trial.
   */
  CASE
    WHEN l.evaluated_at IS NOT NULL
    THEN extract(epoch FROM (l.evaluated_at - r.issued_at)) / 86400.0
    ELSE NULL
  END AS days_to_evaluation,
  l.cart_adherence_pct,
  l.engine_cart_target_attainment_pct,
  l.verdicts,
  r.duplicate_sku_line_flag,
  r.line_type_conflict_flag,
  r.invalid_recommended_value_flag,
  r.suspect_target_order_value_fallback_bug,
  (r.recommended_value IS NULL OR r.recommended_value <= 0)
    AS null_attainment_denominator_flag,
  (
    l.performance_row_count = 1
    AND l.linked_invoice_count = 1
    AND NOT l.invoice_header_link_mismatch_flag
    AND r.recommended_value > 0
    AND 100 * COALESCE(a.positive_actual_value, 0) / r.recommended_value > 100
  ) AS over_100_pct_attainment_flag,
  r.is_known_product,
  r.product_currently_active,
  CASE
    WHEN l.performance_row_count = 1
      AND l.linked_invoice_count = 1
      AND NOT l.invoice_header_link_mismatch_flag
      THEN 'EXACT_LINKED_RECOMMENDATION_OUTCOME'
    WHEN l.performance_row_count IS NULL
      THEN 'AWAITING_LINKED_FEEDBACK'
    ELSE 'DATA_QUALITY_HOLD_INVALID_LINK_CARDINALITY'
  END AS metric_basis
FROM sales_analytics.fact_recommendation_line r
LEFT JOIN performance_link l
  ON l.customer_id = r.customer_id
 AND l.cart_id = r.cart_id
 AND l.rec_id = r.rec_id
LEFT JOIN actual_by_invoice_sku a
  ON a.invoice_id = l.valid_linked_invoice_id
 AND a.product_id = r.product_id;

CREATE MATERIALIZED VIEW IF NOT EXISTS
  sales_analytics.fact_recommendation_line_outcome
AS
SELECT * FROM sales_analytics.vw_fact_recommendation_line_outcome_source
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_fact_recommendation_outcome_grain
  ON sales_analytics.fact_recommendation_line_outcome
  (customer_id, cart_id, rec_id, product_id);
CREATE INDEX IF NOT EXISTS ix_fact_recommendation_outcome_date_region_sku
  ON sales_analytics.fact_recommendation_line_outcome
  (issued_at, reporting_region_key, product_id);
CREATE INDEX IF NOT EXISTS ix_fact_recommendation_outcome_state_type
  ON sales_analytics.fact_recommendation_line_outcome
  (outcome_status, line_type, evaluated_flag);

/* -------------------------------------------------------------------------- */
/* 6. Current whitespace/familiar proxy opportunity by SKU and region         */
/* -------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW sales_analytics.mart_sku_region_opportunity_current AS
WITH population AS (
  SELECT
    reporting_region_key,
    COALESCE(cluster_id, '__UNKNOWN_CLUSTER__') AS reporting_cluster_key,
    count(DISTINCT customer_id) FILTER (WHERE active)
      AS active_modeled_customer_count
  FROM sales_analytics.dim_customer_current
  GROUP BY reporting_region_key, COALESCE(cluster_id, '__UNKNOWN_CLUSTER__')
),
familiar AS (
  SELECT
    reporting_region_key,
    cluster_key AS reporting_cluster_key,
    product_id,
    count(DISTINCT customer_id) AS top8_familiar_customer_count
  FROM sales_analytics.bridge_customer_familiar_sku
  GROUP BY reporting_region_key, cluster_key, product_id
),
whitespace AS (
  SELECT
    reporting_region_key,
    cluster_key AS reporting_cluster_key,
    product_id,
    count(DISTINCT customer_id) AS eligible_seed_customer_count,
    avg(peer_penetration_pct) AS average_peer_penetration_pct,
    avg(category_score) AS average_category_score
  FROM sales_analytics.bridge_customer_whitespace_seed
  GROUP BY reporting_region_key, cluster_key, product_id
),
keys AS (
  SELECT reporting_region_key, reporting_cluster_key, product_id FROM familiar
  UNION
  SELECT reporting_region_key, reporting_cluster_key, product_id FROM whitespace
)
SELECT
  k.reporting_region_key,
  k.reporting_cluster_key,
  k.product_id,
  p.active_modeled_customer_count,
  COALESCE(f.top8_familiar_customer_count, 0)
    AS top8_familiar_customer_count,
  round(
    100.0 * COALESCE(f.top8_familiar_customer_count, 0)
      / NULLIF(p.active_modeled_customer_count, 0),
    2
  ) AS modeled_familiar_proxy_penetration_pct,
  COALESCE(w.eligible_seed_customer_count, 0)
    AS whitespace_seed_eligible_customer_count,
  round(
    100.0 * COALESCE(w.eligible_seed_customer_count, 0)
      / NULLIF(p.active_modeled_customer_count, 0),
    2
  ) AS whitespace_seed_eligibility_rate_pct,
  w.average_peer_penetration_pct,
  w.average_category_score,
  'CURRENT TOP_8 FAMILIAR / SELECTED WHITESPACE SEED PROXY'
    AS metric_basis,
  clock_timestamp() AS as_of
FROM keys k
LEFT JOIN population p
  ON p.reporting_region_key = k.reporting_region_key
 AND p.reporting_cluster_key = k.reporting_cluster_key
LEFT JOIN familiar f
  ON f.reporting_region_key = k.reporting_region_key
 AND f.reporting_cluster_key = k.reporting_cluster_key
 AND f.product_id = k.product_id
LEFT JOIN whitespace w
  ON w.reporting_region_key = k.reporting_region_key
 AND w.reporting_cluster_key = k.reporting_cluster_key
 AND w.product_id = k.product_id;

/* -------------------------------------------------------------------------- */
/* 7. Additive daily SKU/region KPI mart                                      */
/* -------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW sales_analytics.vw_mart_sku_region_day_source AS
WITH recommendation AS (
  SELECT
    o.issued_at::date AS metric_date,
    o.reporting_region_key,
    o.reporting_cluster_key,
    o.product_id,
    count(*)::bigint AS recommendation_line_exposures,
    count(DISTINCT o.customer_id)::bigint AS customers_reached_daily,
    sum(o.recommended_units) AS recommended_units,
    sum(o.recommended_value) AS recommended_value,
    count(*) FILTER (
      WHERE o.evaluated_flag
        AND o.valid_exact_link_flag
    )::bigint AS evaluated_line_exposures,
    count(*) FILTER (
      WHERE o.evaluated_flag
        AND o.valid_exact_link_flag
        AND o.accepted_flag
    )::bigint AS accepted_line_exposures,
    count(DISTINCT o.customer_id) FILTER (
      WHERE o.evaluated_flag
        AND o.valid_exact_link_flag
        AND o.accepted_flag
    )::bigint AS accepting_customers_daily,
    sum(o.recommended_value) FILTER (
      WHERE o.evaluated_flag
        AND o.valid_exact_link_flag
        AND o.recommended_value > 0
    ) AS evaluated_recommended_value,
    sum(o.matched_actual_value) FILTER (
      WHERE o.evaluated_flag
        AND o.valid_exact_link_flag
    ) AS matched_actual_value,
    count(*) FILTER (
      WHERE o.outcome_status = 'AWAITING_FEEDBACK'
    )::bigint AS pending_exposures,
    count(*) FILTER (
      WHERE o.outcome_status = 'EXPIRED_AWAITING_FEEDBACK'
    )::bigint AS expired_unevaluated_exposures,
    count(*) FILTER (
      WHERE o.evaluated_flag
        OR o.expires_at <= clock_timestamp()
    )::bigint AS evaluation_due_exposures,
    count(*) FILTER (
      WHERE o.line_type = 'WHITESPACE_TRIAL'
    )::bigint AS whitespace_trial_exposures,
    count(*) FILTER (
      WHERE o.line_type = 'WHITESPACE_TRIAL'
        AND o.evaluated_flag
        AND o.valid_exact_link_flag
    )::bigint AS evaluated_whitespace_trial_exposures,
    count(*) FILTER (
      WHERE o.whitespace_captured_flag
    )::bigint AS captured_whitespace_trial_exposures,
    count(*) FILTER (
      WHERE o.line_type = 'GRADUATED'
    )::bigint AS graduated_exposures,
    count(*) FILTER (
      WHERE o.suspect_target_order_value_fallback_bug
    )::bigint AS suspect_target_fallback_exposures,
    count(*) FILTER (
      WHERE o.duplicate_sku_line_flag
        OR o.line_type_conflict_flag
        OR NOT o.is_known_product
    )::bigint AS data_quality_hold_exposures
  FROM sales_analytics.fact_recommendation_line_outcome o
  GROUP BY
    o.issued_at::date,
    o.reporting_region_key,
    o.reporting_cluster_key,
    o.product_id
),
invoice_sales AS (
  SELECT
    f.invoice_date::date AS metric_date,
    f.reporting_region_key,
    f.reporting_cluster_key,
    f.product_id,
    sum(f.line_value) FILTER (
      WHERE f.valid_invoice_line_flag
        AND f.positive_posted_sell_in_flag
    ) AS processed_invoice_sales_value,
    sum(f.quantity) FILTER (
      WHERE f.valid_invoice_line_flag
        AND f.positive_posted_sell_in_flag
    ) AS processed_invoice_sales_quantity,
    count(DISTINCT f.invoice_id) FILTER (
      WHERE f.valid_invoice_line_flag
        AND f.positive_posted_sell_in_flag
    )::bigint AS processed_invoice_count,
    count(DISTINCT f.customer_id) FILTER (
      WHERE f.valid_invoice_line_flag
        AND f.positive_posted_sell_in_flag
    )::bigint AS distinct_observed_buyers_daily
  FROM sales_analytics.fact_invoice_line f
  WHERE f.product_id IS NOT NULL
  GROUP BY
    f.invoice_date::date,
    f.reporting_region_key,
    f.reporting_cluster_key,
    f.product_id
),
population AS (
  SELECT
    reporting_region_key,
    COALESCE(cluster_id, '__UNKNOWN_CLUSTER__') AS reporting_cluster_key,
    count(DISTINCT customer_id) FILTER (WHERE active)
      AS active_modeled_customer_count
  FROM sales_analytics.dim_customer_current
  GROUP BY reporting_region_key, COALESCE(cluster_id, '__UNKNOWN_CLUSTER__')
),
combined AS (
  SELECT
    COALESCE(r.metric_date, s.metric_date) AS metric_date,
    COALESCE(r.reporting_region_key, s.reporting_region_key)
      AS reporting_region_key,
    COALESCE(r.reporting_cluster_key, s.reporting_cluster_key)
      AS reporting_cluster_key,
    COALESCE(r.product_id, s.product_id) AS product_id,
    r.recommendation_line_exposures,
    r.customers_reached_daily,
    r.recommended_units,
    r.recommended_value,
    r.evaluated_line_exposures,
    r.accepted_line_exposures,
    r.accepting_customers_daily,
    r.evaluated_recommended_value,
    r.matched_actual_value,
    r.pending_exposures,
    r.expired_unevaluated_exposures,
    r.evaluation_due_exposures,
    r.whitespace_trial_exposures,
    r.evaluated_whitespace_trial_exposures,
    r.captured_whitespace_trial_exposures,
    r.graduated_exposures,
    r.suspect_target_fallback_exposures,
    r.data_quality_hold_exposures,
    s.processed_invoice_sales_value,
    s.processed_invoice_sales_quantity,
    s.processed_invoice_count,
    s.distinct_observed_buyers_daily
  FROM recommendation r
  FULL OUTER JOIN invoice_sales s
    ON s.metric_date = r.metric_date
   AND s.reporting_region_key = r.reporting_region_key
   AND s.reporting_cluster_key = r.reporting_cluster_key
   AND s.product_id = r.product_id
)
SELECT
  c.metric_date,
  c.reporting_region_key,
  c.reporting_cluster_key,
  c.product_id,
  COALESCE(c.recommendation_line_exposures, 0)
    AS recommendation_line_exposures,
  COALESCE(c.customers_reached_daily, 0) AS customers_reached_daily,
  COALESCE(c.recommended_units, 0) AS recommended_units,
  COALESCE(c.recommended_value, 0) AS recommended_value,
  COALESCE(c.evaluated_line_exposures, 0) AS evaluated_line_exposures,
  COALESCE(c.accepted_line_exposures, 0) AS accepted_line_exposures,
  COALESCE(c.accepting_customers_daily, 0) AS accepting_customers_daily,
  COALESCE(c.evaluated_recommended_value, 0)
    AS evaluated_recommended_value,
  COALESCE(c.matched_actual_value, 0) AS matched_actual_value,
  COALESCE(c.pending_exposures, 0) AS pending_exposures,
  COALESCE(c.expired_unevaluated_exposures, 0)
    AS expired_unevaluated_exposures,
  COALESCE(c.evaluation_due_exposures, 0) AS evaluation_due_exposures,
  COALESCE(c.whitespace_trial_exposures, 0) AS whitespace_trial_exposures,
  COALESCE(c.evaluated_whitespace_trial_exposures, 0)
    AS evaluated_whitespace_trial_exposures,
  COALESCE(c.captured_whitespace_trial_exposures, 0)
    AS captured_whitespace_trial_exposures,
  COALESCE(c.graduated_exposures, 0) AS graduated_exposures,
  COALESCE(c.suspect_target_fallback_exposures, 0)
    AS suspect_target_fallback_exposures,
  COALESCE(c.data_quality_hold_exposures, 0)
    AS data_quality_hold_exposures,
  round(
    100.0 * c.evaluated_line_exposures
      / NULLIF(c.evaluation_due_exposures, 0),
    2
  ) AS evaluation_coverage_pct,
  round(
    100.0 * c.accepted_line_exposures
      / NULLIF(c.evaluated_line_exposures, 0),
    2
  ) AS line_acceptance_rate_pct,
  round(
    100 * c.matched_actual_value
      / NULLIF(c.evaluated_recommended_value, 0),
    2
  ) AS sku_value_attainment_pct,
  round(
    100.0 * c.captured_whitespace_trial_exposures
      / NULLIF(c.evaluated_whitespace_trial_exposures, 0),
    2
  ) AS whitespace_capture_rate_pct,
  COALESCE(c.processed_invoice_sales_value, 0)
    AS processed_invoice_sales_value,
  COALESCE(c.processed_invoice_sales_quantity, 0)
    AS processed_invoice_sales_quantity,
  COALESCE(c.processed_invoice_count, 0) AS processed_invoice_count,
  COALESCE(c.distinct_observed_buyers_daily, 0)
    AS distinct_observed_buyers_daily,
  p.active_modeled_customer_count,
  round(
    100.0 * c.distinct_observed_buyers_daily
      / NULLIF(p.active_modeled_customer_count, 0),
    2
  ) AS daily_observed_buyer_penetration_pct,
  'RECOMMENDATION KPIS BY ISSUED DATE; SELL-IN BY INVOICE DATE'
    AS date_basis,
  'EXACT LINKED OUTCOME + PROCESSED-FEEDBACK SELL-IN + CURRENT REGION PROXY'
    AS metric_basis,
  'Daily distinct customer counts are non-additive across dates'
    AS non_additive_metric_warning,
  clock_timestamp() AS refreshed_at
FROM combined c
LEFT JOIN population p
  ON p.reporting_region_key = c.reporting_region_key
 AND p.reporting_cluster_key = c.reporting_cluster_key;

CREATE MATERIALIZED VIEW IF NOT EXISTS sales_analytics.mart_sku_region_day
AS
SELECT * FROM sales_analytics.vw_mart_sku_region_day_source
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mart_sku_region_day_grain
  ON sales_analytics.mart_sku_region_day
  (metric_date, reporting_region_key, reporting_cluster_key, product_id);
CREATE INDEX IF NOT EXISTS ix_mart_sku_region_day_sku_date
  ON sales_analytics.mart_sku_region_day (product_id, metric_date);
CREATE INDEX IF NOT EXISTS ix_mart_sku_region_day_region_date
  ON sales_analytics.mart_sku_region_day
  (reporting_region_key, metric_date);

/* -------------------------------------------------------------------------- */
/* 8. Governed metric catalogue and unavailable-data gaps                     */
/* -------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW sales_analytics.metric_definition AS
SELECT *
FROM (
  VALUES
    (
      'recommendation_line_exposures',
      'Exact recommendation exposure',
      'count of deduplicated customer_id + cart_id + rec_id + product_id keys',
      'none',
      'AVAILABLE',
      'Duplicate cart SKU lines are summed and counted once.'
    ),
    (
      'evaluation_coverage_pct',
      'Exact linked recommendation outcome',
      '100 * valid evaluated line exposures / evaluation-due exposures',
      'deduplicated issued lines that are evaluated or past expires_at',
      'AVAILABLE',
      'Pending within the 30-day feedback window is not failure.'
    ),
    (
      'line_acceptance_rate_pct',
      'Exact linked recommendation outcome',
      '100 * accepted valid evaluated exposures / valid evaluated exposures',
      'one exact customer + cart + rec link to one invoice',
      'AVAILABLE',
      'Positive linked invoice value means accepted; pending is excluded.'
    ),
    (
      'sku_value_attainment_pct',
      'Exact linked recommendation outcome',
      '100 * sum positive matched actual value / sum evaluated recommended value',
      'valid evaluated lines with recommended_value > 0',
      'AVAILABLE',
      'Null on zero denominator; values above 100% remain uncapped.'
    ),
    (
      'whitespace_capture_rate_pct',
      'Exact linked recommendation outcome',
      '100 * captured WHITESPACE_TRIAL keys / valid evaluated WHITESPACE_TRIAL keys',
      'deduplicated evaluated trial keys only',
      'AVAILABLE',
      'GRADUATED is excluded. Ratio of sums, never average invoice rates.'
    ),
    (
      'processed_invoice_sales_value',
      'Processed-feedback sell-in',
      'sum positive POSTED sales_invoice_lines.line_value',
      'invoices processed by the feedback service',
      'AVAILABLE_WITH_COVERAGE_CAVEAT',
      'Not total ERP sales until feed completeness is reconciled.'
    ),
    (
      'post_launch_observed_buyer_penetration',
      'Post-launch observed sales proxy',
      '100 * distinct processed-feedback buyers / active modeled customers in scope',
      'current modeled customer population in reporting region',
      'AVAILABLE_AS_PROXY',
      'Use fact_invoice_line for arbitrary periods; daily mart buyers are non-additive.'
    ),
    (
      'modeled_familiar_proxy_penetration',
      'Top-8 familiar proxy',
      '100 * customers whose retained familiar JSON contains SKU / active modeled customers',
      'current modeled customer population in scope',
      'AVAILABLE_AS_PROXY',
      'Understates buyers whose SKU ranked outside top eight.'
    ),
    (
      'whitespace_seed_eligibility_rate',
      'Selected-seed whitespace proxy',
      '100 * customers retaining SKU as selected whitespace seed / active modeled customers',
      'current modeled customer population in scope',
      'AVAILABLE_AS_PROXY',
      'Stored top categories/seeds are not exhaustive opportunity.'
    ),
    (
      'full_model_window_sku_penetration',
      'Additional market data required',
      '100 * model-window buying customers / active modeled customers in scope',
      'complete customer-SKU baseline for a governed model window',
      'UNAVAILABLE',
      'Current customer model stores only top-8 familiar and selected seeds.'
    ),
    (
      'addressable_local_market_penetration',
      'Additional market data required',
      '100 * buying or stocking outlets / authoritative addressable outlet universe',
      'governed outlet universe by stable region/channel',
      'UNAVAILABLE',
      'Area labels are not a governed local-market universe.'
    ),
    (
      'true_sell_through_rate',
      'Additional market data required',
      '100 * downstream units sold / units available or received',
      'inventory receipts/availability and downstream POS',
      'UNAVAILABLE',
      'Current source is distributor invoiced sell-in only.'
    )
) AS d(
  metric_name,
  basis_label,
  exact_formula,
  denominator,
  availability,
  guardrail
);

/* -------------------------------------------------------------------------- */
/* 9. Data-quality and analytics-health checks                                */
/* -------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW sales_analytics.data_quality_health AS
WITH checks AS (
  SELECT
    'DQ001_DUPLICATE_RECOMMENDATION_SKU_LINES'::text AS check_id,
    'WARN'::text AS severity,
    count(*)::bigint AS affected_row_count,
    'Duplicate SKU lines were aggregated at the governed recommendation grain.'
      AS description,
    'Inspect producer; keep source_line_count and summed units/value.'
      AS remediation,
    'Exposure count protected; source cart quality affected.' AS metric_impact
  FROM sales_analytics.fact_recommendation_line
  WHERE duplicate_sku_line_flag

  UNION ALL
  SELECT
    'DQ002_CONFLICTING_RECOMMENDATION_LINE_TYPES',
    'ERROR',
    count(*)::bigint,
    'The same cart SKU has multiple original line types.',
    'Quarantine the line and correct the cart producer.',
    'Whitespace and graduated classifications are unreliable.'
  FROM sales_analytics.fact_recommendation_line
  WHERE line_type_conflict_flag

  UNION ALL
  SELECT
    'DQ003_DUPLICATE_INVOICE_LINE_NUMBER',
    'ERROR',
    count(*)::bigint,
    'More than one source row shares invoice_id + line_no.',
    'Reconcile invoice ingestion and enforce the documented unique key.',
    'Affected lines are excluded from valid sell-in and acceptance.'
  FROM sales_analytics.fact_invoice_line
  WHERE source_line_row_count > 1

  UNION ALL
  SELECT
    'DQ004_DUPLICATE_INVOICE_SKU_LINES',
    'INFO',
    count(*)::bigint,
    'A valid invoice contains the same SKU on multiple line numbers.',
    'No correction required when legitimate; outcome aggregation sums the lines.',
    'Acceptance remains one; actual units/value are aggregated.'
  FROM (
    SELECT invoice_id, product_id
    FROM sales_analytics.fact_invoice_line
    WHERE valid_invoice_line_flag
    GROUP BY invoice_id, product_id
    HAVING count(*) > 1
  ) x

  UNION ALL
  SELECT
    'DQ005_MULTIPLE_INVOICES_PER_RECOMMENDATION',
    'ERROR',
    count(*)::bigint,
    'One customer + cart + rec key links to multiple performance invoices.',
    'Confirm whether split invoicing is allowed; otherwise correct linkage.',
    'Outcome is placed on data-quality hold and not accepted/rejected.'
  FROM (
    SELECT customer_id, cart_id, rec_id
    FROM sales_intelligence.invoice_performance
    GROUP BY customer_id, cart_id, rec_id
    HAVING count(DISTINCT invoice_id) > 1
  ) x

  UNION ALL
  SELECT
    'DQ006_ORPHAN_INVOICE_PERFORMANCE',
    'ERROR',
    count(*)::bigint,
    'Performance row has no exact operational customer + cart + rec cart.',
    'Repair link or quarantine feedback.',
    'Excluded from recommendation-line outcomes.'
  FROM sales_intelligence.invoice_performance p
  WHERE NOT EXISTS (
    SELECT 1
    FROM sales_intelligence.recommendation_carts r
    WHERE r.customer_id = p.customer_id
      AND r.cart_id = p.cart_id
      AND r.rec_id = p.rec_id
  )

  UNION ALL
  SELECT
    'DQ007_ORPHAN_INVOICE_LINES',
    'ERROR',
    count(*)::bigint,
    'Invoice line has no matching invoice header.',
    'Repair invoice ingestion order/idempotency.',
    'Excluded from sell-in and acceptance.'
  FROM sales_analytics.fact_invoice_line
  WHERE orphan_invoice_line_flag

  UNION ALL
  SELECT
    'DQ008_UNKNOWN_PRODUCTS',
    'WARN',
    count(*)::bigint,
    'Observed SKU is absent from the current product master.',
    'Master the SKU; keep the historical unknown-product row visible.',
    'Identity remains visible; governed category/UOM/active state unavailable.'
  FROM sales_analytics.dim_product
  WHERE NOT is_known_product

  UNION ALL
  SELECT
    'DQ009_EXPIRED_UNEVALUATED_RECOMMENDATIONS',
    'WARN',
    count(*)::bigint,
    'Recommendation is past expires_at with no valid feedback.',
    'Run an explicit expiry process and investigate feedback coverage.',
    'Shown as expired/pending, never as rejected.'
  FROM sales_analytics.fact_recommendation_line_outcome
  WHERE outcome_status = 'EXPIRED_AWAITING_FEEDBACK'

  UNION ALL
  SELECT
    'DQ010_PENDING_RECOMMENDATIONS',
    'INFO',
    count(*)::bigint,
    'Recommendation remains inside its feedback window.',
    'No action unless feedback SLA is breached.',
    'Excluded from acceptance denominator.'
  FROM sales_analytics.fact_recommendation_line_outcome
  WHERE outcome_status = 'AWAITING_FEEDBACK'

  UNION ALL
  SELECT
    'DQ011_NULL_OR_ZERO_ATTAINMENT_DENOMINATOR',
    'WARN',
    count(*)::bigint,
    'Recommended value is null or non-positive.',
    'Correct cart generation/source data; do not coerce attainment to zero.',
    'SKU attainment is null.'
  FROM sales_analytics.fact_recommendation_line_outcome
  WHERE null_attainment_denominator_flag

  UNION ALL
  SELECT
    'DQ012_ATTAINMENT_ABOVE_100_PERCENT',
    'INFO',
    count(*)::bigint,
    'Matched invoice value exceeds the recommended value.',
    'Preserve the value and display an uncapped reference line.',
    'Valid over-attainment; not an error by itself.'
  FROM sales_analytics.fact_recommendation_line_outcome
  WHERE over_100_pct_attainment_flag

  UNION ALL
  SELECT
    'DQ013_SUSPECT_TARGET_ORDER_VALUE_FALLBACK',
    'WARN',
    count(*)::bigint,
    'Target is 1 under historical fallback, matching the known missing-target bug signature.',
    'Fix/approve request normalization before interpreting target-based KPIs.',
    'Heuristic flag; legitimate target value 1 is possible.'
  FROM sales_analytics.fact_recommendation_line
  WHERE suspect_target_order_value_fallback_bug

  UNION ALL
  SELECT
    'DQ014_RECOMMENDATION_REGION_SNAPSHOT_MISSING',
    'WARN',
    count(*)::bigint,
    'Recommendation rows lack region/cluster/model snapshots.',
    'Persist immutable snapshots on issue or add a valid SCD2 customer join.',
    'Historical region reporting currently uses the current customer model.'
  FROM sales_analytics.fact_recommendation_line
  WHERE recommendation_time_region_id IS NULL

  UNION ALL
  SELECT
    'DQ015_MODEL_WINDOW_METADATA_MISSING',
    'ERROR',
    count(*)::bigint,
    'Logical model run lacks source-window dates.',
    'Persist model_window_start/end with the logical model build.',
    'Full model-window penetration cannot be calculated.'
  FROM sales_analytics.dim_model_run
  WHERE model_window_start IS NULL OR model_window_end IS NULL

  UNION ALL
  SELECT
    'DQ016_CUSTOMERS_WITHOUT_FAMILIAR_PRODUCTS',
    'WARN',
    count(*)::bigint,
    'Active modeled customer has no retained familiar products.',
    'Validate model generation and source sales history.',
    'Familiar recommendations/proxy penetration may be incomplete.'
  FROM sales_analytics.dim_customer_current
  WHERE active AND familiar_entry_count = 0

  UNION ALL
  SELECT
    'DQ017_CUSTOMERS_WITHOUT_WHITESPACE_PRODUCTS',
    'INFO',
    count(*)::bigint,
    'Active modeled customer has no retained whitespace categories.',
    'Validate whether no opportunity is legitimate or model data is incomplete.',
    'Stored-seed opportunity is zero, not proof of full market penetration.'
  FROM sales_analytics.dim_customer_current
  WHERE active AND whitespace_category_count = 0

  UNION ALL
  SELECT
    'DQ018_MISSING_REGION',
    'ERROR',
    count(*)::bigint,
    'Current modeled customer has no area label.',
    'Map customer to a governed region before regional reporting.',
    'Rows remain in __UNKNOWN_REGION__.'
  FROM sales_analytics.dim_customer_current
  WHERE active AND reporting_region_key = '__UNKNOWN_REGION__'

  UNION ALL
  SELECT
    'DQ019_MISSING_RECOMMENDATION_CATEGORY',
    'WARN',
    count(*)::bigint,
    'Recommendation line has no issue-time category.',
    'Persist authoritative category snapshot/category source on issue.',
    'Category filters may fall back to current product master.'
  FROM sales_analytics.fact_recommendation_line
  WHERE recommendation_category IS NULL

  UNION ALL
  SELECT
    'DQ020_MISSING_SALES_AGENT',
    'WARN',
    count(*)::bigint,
    'Recommendation line has no sales_agent_id.',
    'Make agent identity mandatory or define an unknown-agent policy.',
    'Agent attribution is incomplete.'
  FROM sales_analytics.fact_recommendation_line
  WHERE sales_agent_id IS NULL OR btrim(sales_agent_id) = ''

  UNION ALL
  SELECT
    'GAP001_FULL_MARKET_PENETRATION_UNAVAILABLE',
    'INFO',
    1::bigint,
    'Complete customer-SKU model-window facts and an addressable outlet universe are absent.',
    'Integrate governed baseline facts and outlet universe.',
    'Only top-8 familiar and observed-feedback proxies are publishable.'

  UNION ALL
  SELECT
    'GAP002_TRUE_SELL_THROUGH_UNAVAILABLE',
    'INFO',
    1::bigint,
    'Inventory availability/receipts and downstream POS are absent.',
    'Integrate opening/closing stock, receipts/transfers/returns and/or POS.',
    'Label all current sales metrics processed-feedback sell-in.'
)
SELECT
  check_id,
  severity,
  affected_row_count,
  CASE
    WHEN affected_row_count = 0 THEN 'PASS'
    WHEN severity = 'ERROR' THEN 'FAIL'
    ELSE 'ATTENTION'
  END AS check_status,
  description,
  remediation,
  metric_impact,
  clock_timestamp() AS checked_at
FROM checks;

/* -------------------------------------------------------------------------- */
/* 10. Refresh and optional source-index guidance                             */
/* -------------------------------------------------------------------------- */

/*
 * Refresh in this exact dependency order after feedback ingestion, and refresh
 * all objects after a model upload:
 *
 *   REFRESH MATERIALIZED VIEW CONCURRENTLY
 *     sales_analytics.bridge_customer_familiar_sku;
 *   REFRESH MATERIALIZED VIEW CONCURRENTLY
 *     sales_analytics.bridge_customer_whitespace_seed;
 *   REFRESH MATERIALIZED VIEW CONCURRENTLY
 *     sales_analytics.fact_recommendation_line;
 *   REFRESH MATERIALIZED VIEW CONCURRENTLY
 *     sales_analytics.fact_invoice_line;
 *   REFRESH MATERIALIZED VIEW CONCURRENTLY
 *     sales_analytics.fact_recommendation_line_outcome;
 *   REFRESH MATERIALIZED VIEW CONCURRENTLY
 *     sales_analytics.mart_sku_region_day;
 *
 * Run each CONCURRENTLY statement outside an explicit transaction. The unique
 * indexes above are required for concurrent refresh.
 *
 * The following operational-source indexes are recommendations only. They are
 * intentionally not executed because source DDL/row counts/installed indexes
 * were not supplied and this layer must not change the operational engine.
 * A DBA should compare pg_indexes/EXPLAIN first, then create only missing indexes:
 *
 *   CREATE INDEX CONCURRENTLY ... ON sales_intelligence.recommendation_carts
 *     (issued_at, customer_id, cart_id, rec_id, status);
 *   CREATE INDEX CONCURRENTLY ... ON sales_intelligence.sales_invoices
 *     (invoice_date, customer_id, cart_id, rec_id, invoice_id);
 *   CREATE INDEX CONCURRENTLY ... ON sales_intelligence.sales_invoice_lines
 *     (invoice_id, product_id);
 *   CREATE INDEX CONCURRENTLY ... ON sales_intelligence.invoice_performance
 *     (customer_id, cart_id, rec_id, invoice_id, evaluated_at);
 *   CREATE INDEX CONCURRENTLY ... ON sales_intelligence.customer_product_model
 *     (active, area, cluster_id, source_model_version, customer_id);
 *   CREATE INDEX CONCURRENTLY ... ON sales_intelligence.product_master
 *     (product_id, active);
 */
