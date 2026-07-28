WITH envelope AS (
  SELECT convert_from(decode($1, 'base64'), 'UTF8')::jsonb AS data
),
meta AS (
  SELECT
    nullif(btrim(data->>'modelVersion'), '') AS model_version,
    nullif(btrim(data->>'sourceWatermark'), '') AS source_watermark,
    nullif(btrim(data->>'checksum'), '') AS checksum,
    (data->>'generatedAt')::timestamptz AS generated_at,
    (data->>'lookbackStartedAt')::timestamptz AS lookback_started_at,
    (data->>'lookbackEndedAt')::timestamptz AS lookback_ended_at,
    coalesce(data->'validation', '{}'::jsonb) AS validation,
    coalesce(data->'profiles', '[]'::jsonb) AS profiles,
    coalesce(data->'categories', '[]'::jsonb) AS categories
  FROM envelope
),
profile_rows AS (
  SELECT p.*
  FROM meta m,
  jsonb_to_recordset(m.profiles) AS p(
    customer_id text,
    training_location_code text,
    cluster_id text,
    segment text,
    avg_order_value numeric,
    familiar_products jsonb,
    whitespace_products jsonb
  )
  WHERE nullif(btrim(p.customer_id), '') IS NOT NULL
),
category_rows AS (
  SELECT c.*
  FROM meta m,
  jsonb_to_recordset(m.categories) AS c(
    product_id text,
    category text
  )
  WHERE nullif(btrim(c.product_id), '') IS NOT NULL
),
superseded_models AS (
  UPDATE sales_intelligence.model_versions
  SET status = 'SUPERSEDED', superseded_at = now()
  WHERE status = 'ACTIVE'
    AND model_version <> (SELECT model_version FROM meta)
  RETURNING model_version
),
inactive_profiles AS (
  UPDATE sales_intelligence.customer_product_profiles
  SET active = false, updated_at = now()
  WHERE active = true
    AND source_model_version <> (SELECT model_version FROM meta)
  RETURNING customer_id
),
version_row AS (
  INSERT INTO sales_intelligence.model_versions (
    model_version,
    status,
    source_system,
    source_watermark,
    lookback_started_at,
    lookback_ended_at,
    customer_count,
    profile_count,
    checksum,
    validation_json,
    created_at,
    activated_at
  )
  SELECT
    m.model_version,
    'ACTIVE',
    'POSTGRESQL',
    m.source_watermark,
    m.lookback_started_at,
    m.lookback_ended_at,
    (SELECT count(*) FROM profile_rows),
    (SELECT count(*) FROM profile_rows),
    m.checksum,
    m.validation || jsonb_build_object(
      'loaded_through', 'N8N_POSTGRESQL',
      'generated_at', m.generated_at
    ),
    now(),
    now()
  FROM meta m
  ON CONFLICT (model_version) DO UPDATE SET
    status = 'ACTIVE',
    source_system = EXCLUDED.source_system,
    source_watermark = EXCLUDED.source_watermark,
    lookback_started_at = EXCLUDED.lookback_started_at,
    lookback_ended_at = EXCLUDED.lookback_ended_at,
    customer_count = EXCLUDED.customer_count,
    profile_count = EXCLUDED.profile_count,
    checksum = EXCLUDED.checksum,
    validation_json = EXCLUDED.validation_json,
    activated_at = now(),
    superseded_at = NULL
  RETURNING model_version
),
upserted_profiles AS (
  INSERT INTO sales_intelligence.customer_product_profiles (
    customer_id,
    training_location_code,
    cluster_id,
    segment,
    avg_order_value,
    familiar_products,
    whitespace_products,
    source_model_version,
    source_watermark,
    model_updated_at,
    active
  )
  SELECT
    p.customer_id,
    p.training_location_code,
    p.cluster_id,
    p.segment,
    p.avg_order_value,
    coalesce(p.familiar_products, '[]'::jsonb),
    coalesce(p.whitespace_products, '[]'::jsonb),
    v.model_version,
    m.source_watermark,
    m.generated_at,
    true
  FROM profile_rows p
  CROSS JOIN version_row v
  CROSS JOIN meta m
  ON CONFLICT (customer_id, source_model_version) DO UPDATE SET
    training_location_code = EXCLUDED.training_location_code,
    cluster_id = EXCLUDED.cluster_id,
    segment = EXCLUDED.segment,
    avg_order_value = EXCLUDED.avg_order_value,
    familiar_products = EXCLUDED.familiar_products,
    whitespace_products = EXCLUDED.whitespace_products,
    source_watermark = EXCLUDED.source_watermark,
    model_updated_at = EXCLUDED.model_updated_at,
    active = true,
    updated_at = now()
  RETURNING customer_id
),
learning_rows AS (
  INSERT INTO sales_intelligence.customer_learning_state (
    customer_id,
    push_level,
    captured_categories,
    cooldown_products,
    miss_streak,
    avg_order_ewma,
    total_recommendations,
    total_captures,
    last_invoice_id,
    last_cart_id
  )
  SELECT
    p.customer_id,
    1,
    '[]'::jsonb,
    '[]'::jsonb,
    0,
    p.avg_order_value,
    0,
    0,
    NULL,
    NULL
  FROM profile_rows p
  ON CONFLICT (customer_id) DO UPDATE SET
    avg_order_ewma = CASE
      WHEN sales_intelligence.customer_learning_state.total_recommendations = 0
      THEN EXCLUDED.avg_order_ewma
      ELSE sales_intelligence.customer_learning_state.avg_order_ewma
    END,
    updated_at = now()
  RETURNING customer_id
),
category_updates AS (
  UPDATE sales_intelligence.product_master p
  SET
    category = c.category,
    raw_data = p.raw_data || jsonb_build_object(
      'category_basis', 'PYTHON_MODEL_BUILDER',
      'category_model_version', (SELECT model_version FROM meta)
    ),
    updated_at = now()
  FROM category_rows c
  WHERE p.product_id = c.product_id
  RETURNING p.product_id
)
SELECT
  (SELECT model_version FROM version_row) AS model_version,
  (SELECT count(*)::integer FROM upserted_profiles) AS profiles_loaded,
  (SELECT count(*)::integer FROM learning_rows) AS learning_states_ready,
  (SELECT count(*)::integer FROM category_updates) AS categories_updated;
