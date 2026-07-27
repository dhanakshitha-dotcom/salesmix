import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

const MAX_BATCH_ROWS = 600;

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((argument) => argument.split(/=(.*)/s))
    .filter(([key, value]) => key.startsWith("--") && value !== undefined)
    .map(([key, value]) => [key.slice(2), value]),
);

if (!args.geo || !args.sales) {
  throw new Error(
    "Usage: pnpm import:commercial --geo=/path/customer_geo.csv --sales=/path/sales.csv [--webhook=https://...]",
  );
}

const webhook = args.webhook || process.env.COMMERCIAL_IMPORT_WEBHOOK;
if (!webhook) {
  throw new Error(
    "Set COMMERCIAL_IMPORT_WEBHOOK or pass --webhook=https://... before importing.",
  );
}

const clean = (value) => String(value ?? "").trim();
const decimal = (value) => Number(clean(value).replaceAll(",", ""));
const loadCsv = async (file) =>
  parse(await fs.readFile(file, "utf8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

const parseBillingDate = (value) => {
  const match = clean(value).match(
    /^(\d{2}) ([A-Za-z]{3}) (\d{4}) \d{2}:\d{2}:\d{2}$/,
  );
  if (!match) throw new Error(`Unsupported billing date: ${value}`);
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
  if (!month) throw new Error(`Unsupported billing month: ${value}`);
  return `${match[3]}-${month}-${match[1]}`;
};

const splitRegion = (value) => {
  const [code = "", ...nameParts] = clean(value).split("|");
  return {
    regionCode: clean(code),
    regionName: clean(nameParts.join("|")),
    regionLabel: clean(value),
  };
};

const canonicalDescriptions = (rows) => {
  const frequencies = new Map();
  for (const row of rows) {
    const item = clean(row["Item Code"]);
    const description = clean(row["Item Description"]);
    const descriptions = frequencies.get(item) ?? new Map();
    descriptions.set(description, (descriptions.get(description) ?? 0) + 1);
    frequencies.set(item, descriptions);
  }
  return new Map(
    [...frequencies.entries()].map(([item, descriptions]) => [
      item,
      [...descriptions.entries()].sort(
        (left, right) =>
          right[1] - left[1] || left[0].localeCompare(right[0]),
      )[0][0],
    ]),
  );
};

const postBatch = async (webhook, envelope, attempt = 1) => {
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        envelope_b64: Buffer.from(JSON.stringify(envelope), "utf8").toString(
          "base64",
        ),
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
    }
    return text ? JSON.parse(text) : {};
  } catch (error) {
    if (attempt >= 4) throw error;
    await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    return postBatch(webhook, envelope, attempt + 1);
  }
};

const rawGeo = await loadCsv(args.geo);
const rawSales = await loadCsv(args.sales);

const geoSeen = new Set();
const geoRows = rawGeo.flatMap((row, index) => {
  const customerId = clean(row["Customer Code"]);
  const gnCode = clean(row["GN Code"]);
  const key = `${customerId}|${gnCode}`;
  if (!customerId || !gnCode || geoSeen.has(key)) return [];
  geoSeen.add(key);
  return [
    {
      source_row: index + 2,
      customer_id: customerId,
      location_code: gnCode,
      province: clean(row.Province),
      district: clean(row.District),
      ds_division: clean(row["DS Division"]),
      gn_division: clean(row["GN Division"]),
      gn_code: gnCode,
      latitude: decimal(row.Latitude),
      longitude: decimal(row.Longitude),
    },
  ];
});

const geoBatchId = crypto.randomUUID();
const geoResult = await postBatch(webhook, {
  dataset: "geo",
  batchId: geoBatchId,
  sourceFile: path.basename(args.geo),
  rowsReceived: rawGeo.length,
  rowsLoaded: geoRows.length,
  isFinal: true,
  rows: geoRows,
});
console.log(
  JSON.stringify(
    {
      dataset: "geo",
      batchId: geoBatchId,
      sourceRows: rawGeo.length,
      uniqueLocations: geoRows.length,
      result: geoResult,
    },
    null,
    2,
  ),
);

const descriptions = canonicalDescriptions(rawSales);
const invoiceGroups = new Map();
for (const [index, row] of rawSales.entries()) {
  const invoiceId = clean(row["Invoice Number"]);
  const invoiceRows = invoiceGroups.get(invoiceId) ?? [];
  const region = splitRegion(row.Region);
  invoiceRows.push({
    source_row: index + 2,
    invoice_id: invoiceId,
    line_no: String(invoiceRows.length + 1).padStart(4, "0"),
    invoice_date: parseBillingDate(row["Billing Date"]),
    customer_id: clean(row["Customer ID"]),
    sales_rep_id: clean(row["Sales Rep ID"]),
    region_code: region.regionCode,
    region_name: region.regionName,
    region_label: region.regionLabel,
    product_id: clean(row["Item Code"]),
    product_name: descriptions.get(clean(row["Item Code"])),
    quantity: decimal(row["Qty."]),
    net_value: decimal(row["Net Value"]),
  });
  invoiceGroups.set(invoiceId, invoiceRows);
}

const salesBatches = [];
let currentBatch = [];
for (const invoiceRows of invoiceGroups.values()) {
  if (
    currentBatch.length &&
    currentBatch.length + invoiceRows.length > MAX_BATCH_ROWS
  ) {
    salesBatches.push(currentBatch);
    currentBatch = [];
  }
  currentBatch.push(...invoiceRows);
}
if (currentBatch.length) salesBatches.push(currentBatch);

const salesBatchId = crypto.randomUUID();
let rowsProcessed = 0;
let finalSalesResult = {};
for (const [index, rows] of salesBatches.entries()) {
  rowsProcessed += rows.length;
  finalSalesResult = await postBatch(webhook, {
    dataset: "sales",
    batchId: salesBatchId,
    sourceFile: path.basename(args.sales),
    rowsReceived: rowsProcessed,
    rowsLoaded: rowsProcessed,
    isFinal: index === salesBatches.length - 1,
    rows,
  });
  console.log(
    `Imported ${rowsProcessed.toLocaleString("en-US")} of ${rawSales.length.toLocaleString("en-US")} sales/return lines`,
  );
}

console.log(
  JSON.stringify(
    {
      dataset: "sales",
      batchId: salesBatchId,
      batches: salesBatches.length,
      rowsLoaded: rowsProcessed,
      invoices: invoiceGroups.size,
      products: descriptions.size,
      result: finalSalesResult,
    },
    null,
    2,
  ),
);
