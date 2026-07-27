import { createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { parse } from "csv-parse";

const [, , csvPath, webhookUrl] = process.argv;

if (!csvPath || !webhookUrl) {
  console.error(
    "Usage: pnpm import:mbew <path-to-mbew.csv> <temporary-n8n-webhook-url>",
  );
  process.exit(1);
}

const BATCH_SIZE = 800;
const EXPECTED_HEADERS = new Map([
  [0, "Material"],
  [1, "Valuation area"],
  [2, "Valuation Type"],
  [4, "Total Stock"],
  [5, "Total Value"],
  [6, "Price control"],
  [7, "Moving price"],
  [8, "Standard price"],
  [9, "Price unit"],
  [10, "Valuation Class"],
  [28, "Year current period"],
  [29, "Current period"],
]);

const asText = (value) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

const asNumber = (value) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const mapRecord = (record) => ({
  material: asText(record[0]),
  valuation_area: asText(record[1]),
  valuation_type: asText(record[2]),
  total_stock: asNumber(record[4]),
  total_value: asNumber(record[5]),
  price_control: asText(record[6]),
  moving_price: asNumber(record[7]),
  standard_price: asNumber(record[8]),
  price_unit: asNumber(record[9]),
  valuation_class: asText(record[10]),
  fiscal_year: asNumber(record[28]),
  fiscal_period: asNumber(record[29]),
});

const batchId = randomUUID();
let batch = [];
let batchNumber = 0;
let rowsSent = 0;
let lastResult = null;
let headersChecked = false;

async function postBatch(rows, isFinal) {
  const rowsB64 = Buffer.from(JSON.stringify(rows), "utf8").toString("base64");
  const body = JSON.stringify({
    batch_id: batchId,
    rows_b64: rowsB64,
    is_final: isFinal,
  });

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
}

const parser = createReadStream(csvPath).pipe(
  parse({
    bom: true,
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: true,
  }),
);

for await (const record of parser) {
  if (!headersChecked) {
    for (const [index, expected] of EXPECTED_HEADERS) {
      if (record[index] !== expected) {
        throw new Error(
          `Unexpected MBEW header at column ${index + 1}: expected "${expected}", received "${record[index] ?? ""}"`,
        );
      }
    }
    headersChecked = true;
    continue;
  }

  const mapped = mapRecord(record);
  if (!mapped.material) continue;
  batch.push(mapped);

  if (batch.length === BATCH_SIZE) {
    lastResult = await postBatch(batch, false);
    rowsSent += batch.length;
    batchNumber += 1;
    batch = [];

    if (batchNumber % 20 === 0) {
      console.log(`Imported ${rowsSent.toLocaleString("en-US")} valuation rows`);
    }
  }
}

if (batch.length) {
  lastResult = await postBatch(batch, false);
  rowsSent += batch.length;
  batchNumber += 1;
}

lastResult = await postBatch([], true);

console.log(
  JSON.stringify(
    {
      batchId,
      batches: batchNumber,
      rowsSent,
      result: lastResult,
    },
    null,
    2,
  ),
);
