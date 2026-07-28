import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((argument) => argument.split(/=(.*)/s))
    .filter(([key, value]) => key.startsWith("--") && value !== undefined)
    .map(([key, value]) => [key.slice(2), value]),
);

for (const required of ["model", "cleaned", "summary", "audit", "webhook"]) {
  if (!args[required]) {
    throw new Error(
      "Usage: node scripts/import-model-output.mjs " +
        "--model=/path/mix_customer_model_for_n8n.csv " +
        "--cleaned=/path/cleaned_sales_model_input.csv " +
        "--summary=/path/model_run_summary.json " +
        "--audit=/path/input-audit.json --webhook=https://...",
    );
  }
}

const clean = (value) => String(value ?? "").trim();
const readCsv = async (file) =>
  parse(await fs.readFile(file, "utf8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

const sha256 = async (file) =>
  crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");

const modelRows = await readCsv(args.model);
const cleanedRows = await readCsv(args.cleaned);
const summary = JSON.parse(await fs.readFile(args.summary, "utf8"));
const audit = JSON.parse(await fs.readFile(args.audit, "utf8"));

let profiles = modelRows.map((row) => {
  const modelJson = JSON.parse(row.modelJson);
  return {
    customer_id: clean(row.customerId),
    training_location_code: clean(row.area) || null,
    cluster_id: clean(row.clusterId) || null,
    segment: clean(row.segment) || null,
    avg_order_value: Number(row.avgOrderValue || 0),
    familiar_products: Array.isArray(modelJson.familiar)
      ? modelJson.familiar
      : [],
    whitespace_products: Array.isArray(modelJson.whitespace)
      ? modelJson.whitespace
      : [],
  };
});

const categories = new Map();
const dates = [];
for (const row of cleanedRows) {
  const productId = clean(row["Product ID"]);
  const category = clean(row.Category);
  if (productId && category) categories.set(productId, category);
  const match = clean(row.Date).match(
    /^(\d{2}) ([A-Za-z]{3}) (\d{4}) \d{2}:\d{2}:\d{2}$/,
  );
  if (match) {
    const month = {
      Jan: "01",
      Feb: "02",
      Mar: "03",
      Apr: "04",
      May: "05",
      Jun: "06",
      Jul: "07",
      Aug: "08",
      Sep: "09",
      Oct: "10",
      Nov: "11",
      Dec: "12",
    }[match[2]];
    dates.push(`${match[3]}-${month}-${match[1]}T00:00:00.000Z`);
  }
}

const diagnosticProfileLimit = Math.max(
  0,
  Number(args.limitProfiles || 0),
);

if (!diagnosticProfileLimit && profiles.length !== Number(summary.n8nModelRows)) {
  throw new Error(
    `Profile count mismatch: CSV=${profiles.length}, summary=${summary.n8nModelRows}`,
  );
}
if (new Set(profiles.map((row) => row.customer_id)).size !== profiles.length) {
  throw new Error("Duplicate customer IDs in model output");
}

dates.sort();
const generatedAt = summary.generatedAt;
let modelVersion = `direct-dealer-kmedoids-${generatedAt
  .replace(/[-:.TZ]/g, "")
  .slice(0, 14)}`;
if (diagnosticProfileLimit) {
  profiles = profiles.slice(0, diagnosticProfileLimit);
  modelVersion += `-diagnostic-${diagnosticProfileLimit}`;
}
const modelChecksum = await sha256(args.model);
const payload = {
  modelVersion,
  sourceWatermark: audit.sourceSha256,
  checksum: modelChecksum,
  generatedAt,
  lookbackStartedAt: dates.at(0),
  lookbackEndedAt: dates.at(-1),
  validation: {
    status: summary.status,
    sourceFile: path.basename(audit.sourceFile),
    sourceRows: audit.rowCount,
    modelRows: summary.modelRows,
    excludedRows: summary.rowsExcluded,
    customersInSource: audit.customerCount,
    customersModeled: summary.customers,
    productsInSource: audit.productCount,
    productsModeled: summary.skus,
    regionsInSource: audit.areaCount,
    regionsModeled: summary.areas,
    multiAreaCustomersResolved: audit.multiAreaCustomerCount,
    clusterMethod: summary.clusterMethod,
    assumptions: summary.assumptions,
  },
  profiles,
  categories: diagnosticProfileLimit
    ? []
    : [...categories].map(([product_id, category]) => ({
        product_id,
        category,
      })),
};

const response = await fetch(args.webhook, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    payload_b64: Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64",
    ),
  }),
  signal: AbortSignal.timeout(120_000),
});
const text = await response.text();
if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${text.slice(0, 1000)}`);
}
const result = text ? JSON.parse(text) : {};
console.log(
  JSON.stringify(
    {
      status: "MODEL_IMPORTED_THROUGH_N8N",
      modelVersion,
      sourceWatermark: audit.sourceSha256,
      checksum: modelChecksum,
      profiles: profiles.length,
      categories: categories.size,
      lookbackStartedAt: dates.at(0),
      lookbackEndedAt: dates.at(-1),
      result,
    },
    null,
    2,
  ),
);
