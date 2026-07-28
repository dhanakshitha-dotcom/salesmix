BEGIN;

CREATE TABLE IF NOT EXISTS sales_intelligence.rebuild_backup_mbew_20260728 AS
SELECT m.*
FROM sales_intelligence.sap_mbew m
WHERE m.batch_id = '833861b9-2bab-48e1-a7d0-afddfef4c6f0'::uuid;

CREATE TABLE IF NOT EXISTS sales_intelligence.rebuild_backup_import_batch_20260728 AS
SELECT b.*
FROM sales_intelligence.import_batches b
WHERE b.batch_id = '833861b9-2bab-48e1-a7d0-afddfef4c6f0'::uuid;

DO $$
DECLARE
  valuation_rows bigint;
  batch_rows bigint;
BEGIN
  SELECT count(*) INTO valuation_rows
  FROM sales_intelligence.rebuild_backup_mbew_20260728;

  SELECT count(*) INTO batch_rows
  FROM sales_intelligence.rebuild_backup_import_batch_20260728;

  IF valuation_rows <> 308989 THEN
    RAISE EXCEPTION 'MBEW backup count mismatch: expected 308989, found %', valuation_rows;
  END IF;

  IF batch_rows <> 1 THEN
    RAISE EXCEPTION 'MBEW import-batch backup mismatch: expected 1, found %', batch_rows;
  END IF;
END
$$;

TRUNCATE TABLE
  sales_intelligence.cart_line_actions,
  sales_intelligence.invoice_feedback,
  sales_intelligence.customer_learning_state,
  sales_intelligence.recommendation_carts,
  sales_intelligence.source_processing_receipts,
  sales_intelligence.customer_product_profiles,
  sales_intelligence.model_versions,
  sales_intelligence.service_event_log,
  sales_intelligence.sales_invoice_lines,
  sales_intelligence.sales_invoices,
  sales_intelligence.customer_locations,
  sales_intelligence.customers,
  sales_intelligence.product_master,
  sales_intelligence.sap_plants,
  sales_intelligence.sap_mara,
  sales_intelligence.sap_makt,
  sales_intelligence.sap_marc,
  sales_intelligence.sap_mbew,
  sales_intelligence.sap_mvke,
  sales_intelligence.sap_marm,
  sales_intelligence.sap_price_conditions,
  sales_intelligence.import_rejections,
  sales_intelligence.import_batches
RESTART IDENTITY;

INSERT INTO sales_intelligence.import_batches
SELECT *
FROM sales_intelligence.rebuild_backup_import_batch_20260728;

INSERT INTO sales_intelligence.sap_mbew
SELECT *
FROM sales_intelligence.rebuild_backup_mbew_20260728;

WITH product_candidates AS (
  SELECT DISTINCT ON (m.matnr)
    m.matnr,
    m.bwkey,
    m.vprsv,
    m.stprs / coalesce(nullif(m.peinh, 0), 1) AS standard_cost,
    m.verpr / coalesce(nullif(m.peinh, 0), 1) AS moving_cost,
    CASE
      WHEN m.vprsv = 'S' THEN m.stprs / coalesce(nullif(m.peinh, 0), 1)
      WHEN m.vprsv = 'V' THEN m.verpr / coalesce(nullif(m.peinh, 0), 1)
      ELSE coalesce(nullif(m.verpr, 0), m.stprs) / coalesce(nullif(m.peinh, 0), 1)
    END AS selected_cost,
    m.bklas AS valuation_class,
    m.raw_data->'total_stock' AS total_stock,
    m.raw_data->'total_value' AS total_value,
    m.batch_id
  FROM sales_intelligence.sap_mbew m
  ORDER BY
    m.matnr,
    (coalesce(nullif(m.verpr, 0), nullif(m.stprs, 0)) IS NOT NULL) DESC,
    abs(coalesce((m.raw_data->>'total_value')::numeric, 0)) DESC,
    m.bwkey
)
INSERT INTO sales_intelligence.product_master (
  product_id,
  sales_org,
  distribution_channel,
  plant,
  product_name,
  valuation_area,
  price_unit,
  standard_cost,
  moving_average_cost,
  selected_cost,
  active,
  discontinued,
  source_system,
  source_batch_id,
  source_updated_at,
  raw_data
)
SELECT
  p.matnr,
  '',
  '',
  '',
  p.matnr,
  p.bwkey,
  1,
  p.standard_cost,
  p.moving_cost,
  p.selected_cost,
  true,
  false,
  'SAP_FILE',
  p.batch_id,
  now(),
  jsonb_build_object(
    'description_status', 'AWAITING_MAKT',
    'valuation_class', p.valuation_class,
    'price_control', p.vprsv,
    'representative_valuation_area', p.bwkey,
    'total_stock', p.total_stock,
    'total_value', p.total_value,
    'reloaded_at', now()
  )
FROM product_candidates p;

ANALYZE sales_intelligence.sap_mbew;
ANALYZE sales_intelligence.product_master;

COMMIT;

SELECT jsonb_build_object(
  'status', 'SOURCE_TABLES_RESET_AND_PRODUCT_RELOADED',
  'sap_mbew_rows', (SELECT count(*) FROM sales_intelligence.sap_mbew),
  'product_master_rows', (SELECT count(*) FROM sales_intelligence.product_master),
  'customers', (SELECT count(*) FROM sales_intelligence.customers),
  'sales_invoice_lines', (SELECT count(*) FROM sales_intelligence.sales_invoice_lines),
  'profiles', (SELECT count(*) FROM sales_intelligence.customer_product_profiles),
  'preserved_schema_migrations', (SELECT count(*) FROM sales_intelligence.schema_migrations),
  'preserved_source_ownership', (SELECT count(*) FROM sales_intelligence.source_ownership)
) AS rebuild_result;
