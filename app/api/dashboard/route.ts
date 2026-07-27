import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_DATA_SERVICE_URL =
  "https://dhanak05.app.n8n.cloud/webhook/product-mix/sku-visibility";

type DashboardRequest = {
  search?: string;
  valuationArea?: string;
  region?: string;
  limit?: number;
  offset?: number;
};

export async function POST(request: Request) {
  const webhookUrl =
    process.env.N8N_SKU_VISIBILITY_WEBHOOK_URL ?? DEFAULT_DATA_SERVICE_URL;

  try {
    const input = (await request.json()) as DashboardRequest;
    const filters = {
      search: String(input.search ?? "").slice(0, 120),
      valuationArea: String(input.valuationArea ?? "").slice(0, 40),
      region: String(input.region ?? "").slice(0, 120),
      limit: Math.min(Math.max(Number(input.limit) || 50, 1), 200),
      offset: Math.max(Number(input.offset) || 0, 0),
    };
    const requestB64 = Buffer.from(JSON.stringify(filters), "utf8").toString(
      "base64",
    );

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request_b64: requestB64 }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(`Data service returned HTTP ${response.status}.`);
    }

    const result = await response.json();
    if (!result?.payload) {
      throw new Error("The data service returned an unexpected response.");
    }

    return NextResponse.json(result.payload, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("SKU visibility data request failed", error);
    return NextResponse.json(
      { error: "Unable to read live PostgreSQL data right now." },
      { status: 502 },
    );
  }
}
