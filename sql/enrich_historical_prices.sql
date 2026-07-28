WITH price_stats AS (
  SELECT
    l.product_id,
    sum(l.net_value) / nullif(sum(l.quantity), 0) AS historical_unit_net_price,
    max(l.invoice_date) AS latest_invoice_date,
    count(*) AS positive_sales_lines
  FROM sales_intelligence.sales_invoice_lines l
  WHERE l.quantity > 0
    AND l.net_value > 0
  GROUP BY l.product_id
),
price_updates AS (
  UPDATE sales_intelligence.product_master p
  SET
    net_price = s.historical_unit_net_price,
    gross_profit_per_unit = NULL,
    gross_margin_pct = NULL,
    price_valid_from = s.latest_invoice_date,
    raw_data = p.raw_data || jsonb_build_object(
      'price_basis', 'SIX_MONTH_WEIGHTED_AVERAGE_NET_FROM_INVOICES',
      'price_is_current_list_price', false,
      'positive_sales_lines', s.positive_sales_lines,
      'gp_status', 'UNAVAILABLE_COST_CURRENCY_NOT_SUPPLIED'
    ),
    updated_at = now()
  FROM price_stats s
  WHERE p.product_id = s.product_id
  RETURNING p.product_id
),
event_row AS (
  INSERT INTO sales_intelligence.service_event_log (
    event_key,
    event_type,
    payload_json,
    status,
    retryable,
    started_at,
    completed_at
  )
  SELECT
    'product_enrichment:' || model_version,
    'MODEL_REFRESH',
    jsonb_build_object(
      'model_version', model_version,
      'historical_prices_updated', (SELECT count(*) FROM price_updates),
      'price_basis', 'SIX_MONTH_WEIGHTED_AVERAGE_NET_FROM_INVOICES',
      'price_is_current_list_price', false,
      'gp_status', 'UNAVAILABLE_COST_CURRENCY_NOT_SUPPLIED'
    ),
    'COMPLETED',
    false,
    now(),
    now()
  FROM sales_intelligence.model_versions
  WHERE status = 'ACTIVE'
  ON CONFLICT (event_key) DO UPDATE SET
    payload_json = EXCLUDED.payload_json,
    status = 'COMPLETED',
    retryable = false,
    started_at = now(),
    completed_at = now(),
    error_code = NULL,
    error_message = NULL
  RETURNING event_id
)
SELECT
  (SELECT count(*)::integer FROM price_updates) AS historical_prices_updated,
  (SELECT event_id FROM event_row) AS event_id;
