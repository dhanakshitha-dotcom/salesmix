"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";

type Product = {
  product_id: string;
  product_name: string | null;
  category: string | null;
  valuation_area_count: number;
  valuation_areas: string[];
  valuation_class: string | null;
  price_control: string | null;
  selected_cost: number | null;
  total_stock: number;
  currency: string | null;
  sales_line_count: number;
  invoice_count: number;
  buyer_count: number;
  sales_region_count: number;
  net_quantity: number;
  gross_quantity: number;
  return_quantity: number;
  net_sales_value: number;
  gross_sales_value: number;
  returns_value: number;
  first_sale_date: string | null;
  last_sale_date: string | null;
  observed_unit_price: number | null;
  return_rate_pct: number | null;
  buyer_penetration_pct: number | null;
  whitespace_customers: number;
};

type DashboardData = {
  source: string;
  generatedAt: string;
  latestBatch: {
    batchId: string;
    sourceFile: string;
    rowsLoaded: number;
    completedAt: string;
  } | null;
  summary: {
    activeProducts: number;
    pricedProducts: number;
    describedProducts: number;
    valuationRows: number;
    stockBearingProducts: number;
    valuationAreas: number;
    customers: number;
    customerLocations: number;
    salesCustomers: number;
    geocodedSalesCustomers: number;
    geoCoveragePct: number | null;
    invoiceLines: number;
    invoices: number;
    recommendations: number;
    feedbackRecords: number;
    soldProducts: number;
    activeMarketCustomers: number;
    netSales: number;
    grossSales: number;
    returnsValue: number;
    returnRatePct: number | null;
    netQuantity: number;
    salesDateFrom: string | null;
    salesDateTo: string | null;
    salesRegions: number;
  };
  readiness: {
    valuation: boolean;
    descriptions: boolean;
    sellingPrices: boolean;
    regions: boolean;
    invoiceSales: boolean;
    recommendationOutcomes: boolean;
  };
  metricBasis: {
    sales: string;
    penetration: string;
    whitespace: string;
    recommendationAcceptance: string;
  };
  valuationAreas: string[];
  regions: string[];
  monthlySales: {
    month: string;
    gross_sales: number;
    returns_value: number;
    net_sales: number;
  }[];
  products: Product[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
};

const PAGE_SIZE = 50;

const integer = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

const decimal = (value: number | null, maximumFractionDigits = 2) => {
  if (value === null || !Number.isFinite(value)) return "Not available";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
};

const percent = (value: number | null) =>
  value === null || !Number.isFinite(value) ? "Not available" : `${decimal(value, 1)}%`;

const compact = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const dateTime = (value?: string | null) => {
  if (!value) return "Not yet available";
  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Colombo",
  }).format(new Date(value));
};

const monthLabel = (value: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short" }).format(
    new Date(`${value.slice(0, 10)}T00:00:00Z`),
  );

function ReadinessPill({
  ready,
  readyLabel = "Connected",
  waitingLabel = "Awaiting exact link",
}: {
  ready: boolean;
  readyLabel?: string;
  waitingLabel?: string;
}) {
  return (
    <span className={ready ? "live-pill ready" : "live-pill waiting"}>
      <i />
      {ready ? readyLabel : waitingLabel}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="kpi-card live-kpi">
      <div className="kpi-label-row">
        <span>{label}</span>
        <span className="metric-state ready">live</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [search, setSearch] = useState("");
  const [valuationArea, setValuationArea] = useState("");
  const [region, setRegion] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/dashboard", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            search: deferredSearch,
            valuationArea,
            region,
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
          }),
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "The live data service did not respond.");
        }
        setData(payload);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load live data.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [deferredSearch, page, region, valuationArea]);

  const summary = data?.summary;
  const totalPages = Math.max(1, Math.ceil((data?.pagination.total ?? 0) / PAGE_SIZE));
  const visibleRange = useMemo(() => {
    const total = data?.pagination.total ?? 0;
    if (!total) return "0 products";
    const start = page * PAGE_SIZE + 1;
    const end = Math.min(start + PAGE_SIZE - 1, total);
    return `${integer(start)}–${integer(end)} of ${integer(total)}`;
  }, [data?.pagination.total, page]);
  const maxMonthlySales = Math.max(
    1,
    ...(data?.monthlySales.map((item) => item.gross_sales) ?? [1]),
  );

  return (
    <div className="app-shell live-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span><strong>SKU Pulse</strong><small>Product mix intelligence</small></span>
        </div>

        <nav aria-label="Dashboard sections">
          <p className="nav-label">LIVE VISIBILITY</p>
          <button className="nav-item active">
            <span className="nav-icon" aria-hidden="true">▦</span>
            <span><strong>SKU performance</strong><small>Sales, reach and whitespace</small></span>
          </button>
          <button className="nav-item">
            <span className="nav-icon" aria-hidden="true">⌁</span>
            <span><strong>Regional penetration</strong><small>{data?.regions.length ?? 0} sales territories</small></span>
          </button>
          <button className="nav-item">
            <span className="nav-icon" aria-hidden="true">◎</span>
            <span><strong>Sales & returns</strong><small>Six-month invoice history</small></span>
          </button>
        </nav>

        <div className="sidebar-status">
          <div><span className="connection-dot" /><strong>Live PostgreSQL</strong></div>
          <p>Connected through n8n</p>
          <small>
            Last valuation refresh<br />{dateTime(data?.latestBatch?.completedAt)}
          </small>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div className="breadcrumb">
            <span>SKU Visibility</span><b>/</b><strong>Commercial performance</strong>
          </div>
          <div className="topbar-actions">
            <span className="live-data-chip"><i />LIVE DATA</span>
          </div>
        </header>

        <section className="live-notice" role="status">
          <span aria-hidden="true">✓</span>
          <p>
            <strong>Sales and geography are now live.</strong> The dashboard uses the
            supplied direct-dealer invoices, returns, customer locations and SAP
            valuation data. Recommendation acceptance remains separate until an
            invoice carries its exact recommendation or cart reference.
          </p>
        </section>

        <section className="page-heading live-heading">
          <div>
            <p className="eyebrow">SKU PERFORMANCE · JAN–JUN 2026</p>
            <h1>SKU sales, penetration & whitespace</h1>
            <p>
              See which products sell, where they reach customers, where white
              space remains, and how returns affect performance.
            </p>
          </div>
          <div className="freshness">
            <span className="connection-dot" />
            <span><strong>{loading ? "Refreshing…" : "Live connection"}</strong><small>{dateTime(data?.generatedAt)}</small></span>
          </div>
        </section>

        {error && (
          <section className="live-error" role="alert">
            <strong>Live data is temporarily unavailable.</strong><span>{error}</span>
          </section>
        )}

        <section className="kpi-grid live-kpi-grid">
          <MetricCard
            label="Net sales value"
            value={summary ? compact(summary.netSales) : "—"}
            detail={region ? `Selected territory: ${region}` : "All direct-dealer sales territories"}
          />
          <MetricCard
            label="SKUs sold"
            value={summary ? integer(summary.soldProducts) : "—"}
            detail={`Of ${integer(summary?.activeProducts ?? 0)} active product records`}
          />
          <MetricCard
            label="Active buying customers"
            value={summary ? integer(summary.activeMarketCustomers) : "—"}
            detail={`${integer(summary?.invoices ?? 0)} invoices in the six-month file`}
          />
          <MetricCard
            label="Returns"
            value={summary ? compact(summary.returnsValue) : "—"}
            detail={`${percent(summary?.returnRatePct ?? null)} of gross positive sales value`}
          />
        </section>

        <section className="readiness-grid" aria-label="Data readiness">
          <article>
            <span>1</span>
            <div><strong>Sales & returns</strong><small>{integer(summary?.invoiceLines ?? 0)} invoice lines</small></div>
            <ReadinessPill ready={Boolean(data?.readiness.invoiceSales)} />
          </article>
          <article>
            <span>2</span>
            <div><strong>Territory analysis</strong><small>{summary?.salesRegions ?? 0} sales territories</small></div>
            <ReadinessPill ready={Boolean(data?.readiness.regions)} />
          </article>
          <article>
            <span>3</span>
            <div><strong>Customer geocoding</strong><small>{percent(summary?.geoCoveragePct ?? null)} of sales customers</small></div>
            <ReadinessPill
              ready={Boolean(summary && summary.geoCoveragePct === 100)}
              readyLabel="Complete"
              waitingLabel={`${percent(summary?.geoCoveragePct ?? null)} covered`}
            />
          </article>
          <article>
            <span>4</span>
            <div><strong>Recommendation acceptance</strong><small>Needs cart / recommendation ID on invoice</small></div>
            <ReadinessPill ready={Boolean(data?.readiness.recommendationOutcomes)} />
          </article>
        </section>

        <section className="live-filter-panel" aria-label="Product filters">
          <label className="live-search">
            <span>Search SKU</span>
            <input
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(0); }}
              placeholder="Enter SKU or product description"
            />
          </label>
          <label>
            <span>Sales territory</span>
            <select
              value={region}
              onChange={(event) => { setRegion(event.target.value); setPage(0); }}
            >
              <option value="">All sales territories</option>
              {(data?.regions ?? []).map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Valuation area</span>
            <select
              value={valuationArea}
              onChange={(event) => { setValuationArea(event.target.value); setPage(0); }}
            >
              <option value="">All valuation areas</option>
              {(data?.valuationAreas ?? []).map((area) => <option value={area} key={area}>{area}</option>)}
            </select>
          </label>
          <div className="filter-result">
            <strong>{visibleRange}</strong>
            <small>{loading ? "Refreshing results…" : "Live PostgreSQL results"}</small>
          </div>
        </section>

        <section className="commercial-grid">
          <article className="card sales-trend-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">SALES TREND</p>
                <h2>Monthly net sales value</h2>
                <p>Positive sales less returns, using the source file&apos;s value field.</p>
              </div>
              <ReadinessPill ready={Boolean(data?.readiness.invoiceSales)} readyLabel="6 months" />
            </div>
            <div className="monthly-bars">
              {(data?.monthlySales ?? []).map((item) => (
                <div className="month-column" key={item.month}>
                  <strong>{compact(item.net_sales)}</strong>
                  <div className="bar-track">
                    <i style={{ height: `${Math.max(8, (item.net_sales / maxMonthlySales) * 100)}%` }} />
                  </div>
                  <span>{monthLabel(item.month)}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="card metric-basis-card">
            <p className="eyebrow">MEASUREMENT BASIS</p>
            <h2>What penetration means here</h2>
            <p>
              Buyer penetration is the share of active direct-dealer customers in
              the selected territory that purchased a SKU. White space is the
              remaining active buying customers without a positive purchase.
            </p>
            <div className="basis-stat">
              <strong>{integer(summary?.geocodedSalesCustomers ?? 0)} / {integer(summary?.salesCustomers ?? 0)}</strong>
              <span>sales customers have coordinates</span>
            </div>
            <small>
              This is observed customer penetration, not total local-market outlet
              penetration. Full market sizing needs an authoritative outlet universe.
            </small>
          </article>
        </section>

        <section className="card live-product-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">SKU DETAIL</p>
              <h2>Commercial SKU register</h2>
              <p>
                Products are ranked by net sales value. Territory selection recalculates
                buyers, penetration, whitespace, sales and returns.
              </p>
            </div>
            <ReadinessPill ready={Boolean(data?.readiness.invoiceSales)} readyLabel="Live invoices" />
          </div>

          <div className="table-scroll">
            <table className="live-product-table commercial-table">
              <thead>
                <tr>
                  <th>SKU / description</th>
                  <th>Net sales</th>
                  <th>Net quantity</th>
                  <th>Buyers / penetration</th>
                  <th>White space</th>
                  <th>Returns</th>
                  <th>Stock / selected cost</th>
                  <th>Recommendation acceptance</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  <tr><td colSpan={8} className="table-message">Loading live products…</td></tr>
                ) : data?.products.length ? (
                  data.products.map((product) => (
                    <tr key={product.product_id}>
                      <td>
                        <strong className="material-id">{product.product_id}</strong>
                        <small>{product.product_name || "Description not observed in invoice data"}</small>
                      </td>
                      <td>
                        <strong>{decimal(product.net_sales_value)}</strong>
                        <small>{integer(product.invoice_count)} invoices</small>
                      </td>
                      <td>
                        <strong>{decimal(product.net_quantity, 0)}</strong>
                        <small>{decimal(product.return_quantity, 0)} returned</small>
                      </td>
                      <td>
                        <strong>{integer(product.buyer_count)} buyers</strong>
                        <small>{percent(product.buyer_penetration_pct)} observed penetration</small>
                      </td>
                      <td>
                        <strong>{integer(product.whitespace_customers)}</strong>
                        <small>active customers without purchase</small>
                      </td>
                      <td>
                        <strong>{decimal(product.returns_value)}</strong>
                        <small>{percent(product.return_rate_pct)} of gross sales</small>
                      </td>
                      <td>
                        <strong>{decimal(product.total_stock)}</strong>
                        <small>Cost {decimal(product.selected_cost)}</small>
                      </td>
                      <td>
                        <span className="pending-value">Exact link required</span>
                        <small>No inferred acceptance</small>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={8} className="table-message">No products match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="live-pagination">
            <span>{visibleRange}</span>
            <div>
              <button onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0 || loading}>Previous</button>
              <strong>Page {page + 1} of {totalPages}</strong>
              <button onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} disabled={page >= totalPages - 1 || loading}>Next</button>
            </div>
          </div>
        </section>

        <footer>
          <span>SKU Pulse · Live PostgreSQL sales, geography and valuation</span>
          <span>No mock metrics · No inferred recommendation acceptance</span>
        </footer>
      </main>
    </div>
  );
}
