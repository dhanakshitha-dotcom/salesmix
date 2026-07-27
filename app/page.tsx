"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";

type Product = {
  product_id: string;
  product_name: string | null;
  category: string | null;
  valuation_area: string | null;
  valuation_area_count: number;
  valuation_areas: string[];
  valuation_class: string | null;
  price_control: string | null;
  standard_cost: number | null;
  moving_average_cost: number | null;
  selected_cost: number | null;
  total_stock: number;
  total_value: number;
  has_cost: boolean;
  currency: string | null;
  net_price: number | null;
  source_updated_at: string | null;
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
    sellableProducts: number;
    valuationRows: number;
    stockBearingProducts: number;
    valuationAreas: number;
    customers: number;
    customerLocations: number;
    invoiceLines: number;
    recommendations: number;
    feedbackRecords?: number;
  };
  readiness: {
    valuation: boolean;
    descriptions: boolean;
    sellingPrices: boolean;
    regions: boolean;
    invoiceSales: boolean;
    recommendationOutcomes: boolean;
  };
  valuationAreas: string[];
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

const decimal = (value: number | null, currency?: string | null) => {
  if (value === null || !Number.isFinite(value)) return "Not available";
  if (currency) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
};

const dateTime = (value?: string | null) => {
  if (!value) return "Not yet available";
  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Colombo",
  }).format(new Date(value));
};

function ReadinessPill({
  ready,
  readyLabel = "Connected",
  waitingLabel = "Awaiting data",
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
  status,
}: {
  label: string;
  value: string;
  detail: string;
  status?: "ready" | "waiting";
}) {
  return (
    <article className="kpi-card live-kpi">
      <div className="kpi-label-row">
        <span>{label}</span>
        {status && <span className={`metric-state ${status}`}>{status}</span>}
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
  }, [deferredSearch, page, valuationArea]);

  const summary = data?.summary;
  const totalPages = Math.max(
    1,
    Math.ceil((data?.pagination.total ?? 0) / PAGE_SIZE),
  );
  const visibleRange = useMemo(() => {
    const total = data?.pagination.total ?? 0;
    if (!total) return "0 products";
    const start = page * PAGE_SIZE + 1;
    const end = Math.min(start + PAGE_SIZE - 1, total);
    return `${integer(start)}–${integer(end)} of ${integer(total)}`;
  }, [data?.pagination.total, page]);

  return (
    <div className="app-shell live-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>SKU Pulse</strong>
            <small>Product mix intelligence</small>
          </span>
        </div>

        <nav aria-label="Dashboard sections">
          <p className="nav-label">LIVE VISIBILITY</p>
          <button className="nav-item active">
            <span className="nav-icon" aria-hidden="true">▦</span>
            <span>
              <strong>Product master</strong>
              <small>SKU and valuation coverage</small>
            </span>
          </button>
          <button className="nav-item" disabled>
            <span className="nav-icon" aria-hidden="true">⌁</span>
            <span>
              <strong>Regional penetration</strong>
              <small>Awaiting customer locations</small>
            </span>
          </button>
          <button className="nav-item" disabled>
            <span className="nav-icon" aria-hidden="true">◎</span>
            <span>
              <strong>Sales & acceptance</strong>
              <small>Awaiting invoice lines</small>
            </span>
          </button>
        </nav>

        <div className="sidebar-status">
          <div>
            <span className="connection-dot" />
            <strong>Live PostgreSQL</strong>
          </div>
          <p>Connected through n8n</p>
          <small>
            Product valuation refresh
            <br />
            {dateTime(data?.latestBatch?.completedAt)}
          </small>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div className="breadcrumb">
            <span>SKU Visibility</span>
            <b>/</b>
            <strong>Product master</strong>
          </div>
          <div className="topbar-actions">
            <span className="live-data-chip">
              <i />
              LIVE DATA
            </span>
          </div>
        </header>

        <section className="live-notice" role="status">
          <span aria-hidden="true">✓</span>
          <p>
            <strong>Mock data has been removed.</strong> This phase shows the
            supplied SAP MBEW valuation data from PostgreSQL. Descriptions,
            regional penetration, sales, and recommendation acceptance remain
            unavailable until their source tables are loaded.
          </p>
        </section>

        <section className="page-heading live-heading">
          <div>
            <p className="eyebrow">PRODUCT MASTER · POSTGRESQL SOURCE OF TRUTH</p>
            <h1>SKU valuation visibility</h1>
            <p>
              Material-by-material cost and stock coverage, with clear readiness
              for the commercial measures that will follow.
            </p>
          </div>
          <div className="freshness">
            <span className="connection-dot" />
            <span>
              <strong>{loading ? "Refreshing…" : "Live connection"}</strong>
              <small>{dateTime(data?.generatedAt)}</small>
            </span>
          </div>
        </section>

        {error && (
          <section className="live-error" role="alert">
            <strong>Live data is temporarily unavailable.</strong>
            <span>{error}</span>
          </section>
        )}

        <section className="kpi-grid live-kpi-grid">
          <MetricCard
            label="Active material IDs"
            value={summary ? integer(summary.activeProducts) : "—"}
            detail="Distinct provisional products in product_master"
            status={summary ? "ready" : "waiting"}
          />
          <MetricCard
            label="Valuation rows loaded"
            value={summary ? integer(summary.valuationRows) : "—"}
            detail="Rows from the supplied MBEW extract"
            status={data?.readiness.valuation ? "ready" : "waiting"}
          />
          <MetricCard
            label="Materials with cost"
            value={summary ? integer(summary.pricedProducts) : "—"}
            detail="Moving or standard cost is present"
            status={data?.readiness.valuation ? "ready" : "waiting"}
          />
          <MetricCard
            label="Stock-bearing materials"
            value={summary ? integer(summary.stockBearingProducts) : "—"}
            detail="Non-zero total stock in the latest valuation load"
            status={data?.readiness.valuation ? "ready" : "waiting"}
          />
        </section>

        <section className="readiness-grid" aria-label="Data readiness">
          <article>
            <span>1</span>
            <div>
              <strong>Valuation & cost</strong>
              <small>MBEW</small>
            </div>
            <ReadinessPill ready={Boolean(data?.readiness.valuation)} />
          </article>
          <article>
            <span>2</span>
            <div>
              <strong>Descriptions & category</strong>
              <small>MAKT / MARA</small>
            </div>
            <ReadinessPill ready={Boolean(data?.readiness.descriptions)} />
          </article>
          <article>
            <span>3</span>
            <div>
              <strong>Regional penetration</strong>
              <small>Customer locations</small>
            </div>
            <ReadinessPill ready={Boolean(data?.readiness.regions)} />
          </article>
          <article>
            <span>4</span>
            <div>
              <strong>Sales & acceptance</strong>
              <small>Invoice lines + outcomes</small>
            </div>
            <ReadinessPill
              ready={Boolean(
                data?.readiness.invoiceSales &&
                  data?.readiness.recommendationOutcomes,
              )}
            />
          </article>
        </section>

        <section className="live-filter-panel" aria-label="Product filters">
          <label className="live-search">
            <span>Search material</span>
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Enter material ID"
            />
          </label>
          <label>
            <span>Valuation area</span>
            <select
              value={valuationArea}
              onChange={(event) => {
                setValuationArea(event.target.value);
                setPage(0);
              }}
            >
              <option value="">All valuation areas</option>
              {(data?.valuationAreas ?? []).map((area) => (
                <option value={area} key={area}>
                  {area}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Region</span>
            <select disabled value="">
              <option value="">Awaiting customer locations</option>
            </select>
          </label>
          <div className="filter-result">
            <strong>{visibleRange}</strong>
            <small>{loading ? "Refreshing results…" : "Live PostgreSQL results"}</small>
          </div>
        </section>

        <section className="card live-product-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">SKU DETAIL</p>
              <h2>Product valuation register</h2>
              <p>
                Cost is normalized by SAP price unit. Selling price, GP,
                penetration, sales, and recommendation success are intentionally
                blank until their source data is available.
              </p>
            </div>
            <ReadinessPill
              ready={Boolean(data?.readiness.valuation)}
              readyLabel="Live MBEW"
            />
          </div>

          <div className="table-scroll">
            <table className="live-product-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Description</th>
                  <th>Valuation areas</th>
                  <th>Class / control</th>
                  <th>Selected cost</th>
                  <th>Total stock</th>
                  <th>Local sales</th>
                  <th>Mix acceptance</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  <tr>
                    <td colSpan={8} className="table-message">Loading live products…</td>
                  </tr>
                ) : data?.products.length ? (
                  data.products.map((product) => (
                    <tr key={product.product_id}>
                      <td>
                        <strong className="material-id">{product.product_id}</strong>
                        <small>{product.category || "Category pending"}</small>
                      </td>
                      <td>
                        {product.product_name || (
                          <span className="pending-value">Awaiting MAKT</span>
                        )}
                      </td>
                      <td>
                        <strong>{integer(product.valuation_area_count)}</strong>
                        <small>
                          {product.valuation_areas.slice(0, 3).join(", ") ||
                            product.valuation_area ||
                            "Not assigned"}
                        </small>
                      </td>
                      <td>
                        <strong>{product.valuation_class || "—"}</strong>
                        <small>
                          {product.price_control === "S"
                            ? "Standard price"
                            : product.price_control === "V"
                              ? "Moving average"
                              : "Control pending"}
                        </small>
                      </td>
                      <td>
                        <strong>
                          {decimal(product.selected_cost, product.currency)}
                        </strong>
                        <small>Per normalized price unit</small>
                      </td>
                      <td>
                        <strong>{decimal(product.total_stock)}</strong>
                        <small>Across loaded valuation areas</small>
                      </td>
                      <td>
                        <span className="pending-value">Awaiting invoices</span>
                      </td>
                      <td>
                        <span className="pending-value">Awaiting outcomes</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="table-message">
                      No materials match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="live-pagination">
            <span>{visibleRange}</span>
            <div>
              <button
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                disabled={page === 0 || loading}
              >
                Previous
              </button>
              <strong>
                Page {page + 1} of {totalPages}
              </strong>
              <button
                onClick={() =>
                  setPage((current) => Math.min(totalPages - 1, current + 1))
                }
                disabled={page >= totalPages - 1 || loading}
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <footer>
          <span>SKU Pulse · Live PostgreSQL product valuation</span>
          <span>No mock metrics · No product-level outcome inference</span>
        </footer>
      </main>
    </div>
  );
}
