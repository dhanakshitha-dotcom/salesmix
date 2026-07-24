import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("preserves the SKU Pulse decision and metric-honesty contract", async () => {
  const [page, layout, packageJson, netlifyConfig] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../netlify.toml", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Portfolio overview/);
  assert.match(page, /Figures are realistic sample data, not live PostgreSQL results/);
  assert.match(page, /Exact linked recommendation outcome/);
  assert.match(page, /Post-launch observed proxy/);
  assert.match(page, /Additional data required/);
  assert.match(page, /PENDING EXCLUDED/);
  assert.match(layout, /SKU Pulse \| Product Mix Visibility/);
  assert.match(layout, /DEPLOY_PRIME_URL/);
  assert.match(packageJson, /"build": "next build"/);
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
