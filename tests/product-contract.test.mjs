import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("preserves the SKU Pulse live-data and metric-honesty contract", async () => {
  const [page, route, layout, packageJson, netlifyConfig] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../netlify.toml", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Live source:/);
  assert.match(page, /Portfolio overview/);
  assert.match(page, /SKU 360/);
  assert.match(page, /Whitespace & penetration/);
  assert.match(page, /Regional performance/);
  assert.match(page, /Model & data health/);
  assert.match(page, /All sales territories/);
  assert.match(page, /Recommendation acceptance/);
  assert.match(page, /From exposure to repeat sell-in/);
  assert.match(page, /Line count/);
  assert.match(page, />Value</);
  assert.match(page, /Declining/);
  assert.match(page, /Improving/);
  assert.match(page, /Healthy/);
  assert.match(page, /Recommendation mix/);
  assert.match(page, /Whitespace trial/);
  assert.match(page, /Graduated/);
  assert.match(page, /Stored seed to captured trial/);
  assert.match(page, /Unavailable fields remain blank/);
  assert.match(page, /No exact recommendation evidence is stored/);
  assert.doesNotMatch(page, /const\s+(?:products|skus|portfolioData)\s*=\s*\[/i);
  assert.doesNotMatch(page, /DEMO DATA|Transparent demo|realistic sample data/i);
  assert.match(route, /N8N_SKU_VISIBILITY_WEBHOOK_URL/);
  assert.match(route, /cache: "no-store"/);
  assert.match(route, /request_b64/);
  assert.match(route, /region: String/);
  assert.match(layout, /SKU Pulse \| Product Mix Visibility/);
  assert.match(layout, /DEPLOY_PRIME_URL/);
  assert.match(packageJson, /"build": "next build"/);
  assert.match(packageJson, /"import:mbew": "node scripts\/import-mbew\.mjs"/);
  assert.match(packageJson, /"import:commercial": "node scripts\/import-commercial-data\.mjs"/);
  assert.doesNotMatch(packageJson, /vinext|wrangler|drizzle|cloudflare/i);
  assert.match(netlifyConfig, /publish = "\.next"/);
});

test("includes the deployable assets and PostgreSQL analytics contract", async () => {
  await Promise.all([
    access(new URL("public/og.png", projectRoot)),
    access(new URL("sql/analytics_marts.sql", projectRoot)),
    access(new URL("POSTGRES_INTEGRATION.md", projectRoot)),
  ]);
  await assert.rejects(access(new URL(".openai/hosting.json", projectRoot)));
  await assert.rejects(access(new URL("worker/index.ts", projectRoot)));
});
