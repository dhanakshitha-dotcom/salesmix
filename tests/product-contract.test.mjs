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

  assert.match(page, /Sales and geography are now live/);
  assert.match(page, /SKU sales, penetration & whitespace/);
  assert.match(page, /All sales territories/);
  assert.match(page, /Buyer penetration is the share/);
  assert.match(page, /Exact link required/);
  assert.match(page, /No mock metrics · No inferred recommendation acceptance/);
  assert.doesNotMatch(page, /const\s+(?:products|skus|portfolioData)\s*=\s*\[/i);
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
