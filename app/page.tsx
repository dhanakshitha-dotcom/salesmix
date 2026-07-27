"use client";

import {
  type ReactNode,
  useDeferredValue,
  useEffect,
  useState,
} from "react";

type View = "portfolio" | "sku" | "whitespace" | "regional" | "health";

type Product = {
  product_id: string;
  product_name: string | null;
  category: string | null;
  subcategory: string | null;
  valuation_area: string | null;
  valuation_area_count: number;
  valuation_areas: string[];
  valuation_class: string | null;
  price_control: string | null;
  selected_cost: number | null;
  total_stock: number;
  total_value: number;
  has_cost: boolean;
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

type Summary = {
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

type MonthlySale = {
  month: string;
  gross_sales: number;
  returns_value: number;
  net_sales: number;
};

type RegionalSummary = {
  region_label: string;
  invoice_lines: number;
  invoices: number;
  active_buyers: number;
  sold_products: number;
  geocoded_buyers: number;
  net_quantity: number;
  net_sales: number;
  gross_sales: number;
  returns_value: number;
  return_rate_pct: number | null;
  sales_date_from: string | null;
  sales_date_to: string | null;
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
  summary: Summary;
  readiness: {
    valuation: boolean;
    descriptions: boolean;
    sellingPrices: boolean;
    regions: boolean;
    invoiceSales: boolean;
    recommendationOutcomes: boolean;
  };
  valuationAreas: string[];
  regions: string[];
  monthlySales: MonthlySale[];
  regionalSummary: RegionalSummary[];
  products: Product[];
  pagination: { total: number; limit: number; offset: number };
};

const NAV_ITEMS: { id: View; label: string; icon: string; helper: string }[] = [
  { id: "portfolio", label: "Portfolio", icon: "▦", helper: "SKU performance" },
  { id: "sku", label: "SKU 360", icon: "◎", helper: "Evidence & outcomes" },
  { id: "whitespace", label: "Whitespace", icon: "◫", helper: "Opportunity & capture" },
  { id: "regional", label: "Regional", icon: "⌁", helper: "Sell-in performance" },
  { id: "health", label: "Data health", icon: "◇", helper: "Coverage & quality" },
];

const number = (value?: number | null) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

const decimal = (value?: number | null) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

const money = (value?: number | null) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat("en-LK", {
        notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
        maximumFractionDigits: Math.abs(value) >= 1_000_000 ? 1 : 0,
        style: "currency",
        currency: "LKR",
      }).format(value);

const pct = (value?: number | null) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : `${value.toFixed(1)}%`;

const shortDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-LK", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Colombo",
      }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
    : "—";

const dateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-LK", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Colombo",
      }).format(new Date(value))
    : "—";

const regionName = (value: string) =>
  value === "# | Not assigned" ? "Not assigned" : value.split("|").at(-1)?.trim() || value;

function BasisTag({
  children,
  tone = "exact",
}: {
  children: ReactNode;
  tone?: "exact" | "proxy" | "missing";
}) {
  return <span className={`basis-tag basis-${tone}`}>{children}</span>;
}

function KpiCard({
  label,
  value,
  detail,
  tone = "neutral",
  basis,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "positive" | "warning";
  basis?: string;
}) {
  return (
    <article className={`kpi-card kpi-${tone}`}>
      <div className="kpi-label-row">
        <span>{label}</span>
        <button className="info-button" title={`${label}. ${detail}`} aria-label={`About ${label}`}>i</button>
      </div>
      <strong>{value}</strong>
      <div className="kpi-detail"><span>{detail}</span>{basis && <small>{basis}</small>}</div>
    </article>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="section-action">{action}</div>}
    </div>
  );
}

function MiniBars({
  values,
  accent = "blue",
}: {
  values: number[];
  accent?: "blue" | "mint" | "amber";
}) {
  const max = Math.max(...values, 1);
  return (
    <div className={`mini-bars bars-${accent}`} aria-label="Trend spark bars">
      {values.map((value, index) => (
        <span key={`${value}-${index}`} style={{ height: `${Math.max((value / max) * 100, 8)}%` }} />
      ))}
    </div>
  );
}

function Blank({ label = "Awaiting linked data" }: { label?: string }) {
  return <span className="blank-value">{label}</span>;
}

export default function Home() {
  const [view, setView] = useState<View>("portfolio");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [region, setRegion] = useState("");
  const [valuationArea, setValuationArea] = useState("");
  const [search, setSearch] = useState("");
  const [selectedSkuId, setSelectedSkuId] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
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
            limit: 200,
            offset: 0,
          }),
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Live data request failed.");
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
  }, [deferredSearch, refreshKey, region, valuationArea]);

  const summary = data?.summary;
  const items = data?.products ?? [];
  const selectedItem =
    items.find((item) => item.product_id === selectedSkuId) ?? items[0] ?? null;
  const dateRange = summary
    ? `${shortDate(summary.salesDateFrom)} – ${shortDate(summary.salesDateTo)}`
    : "Loading live period";

  const activeFilters = [
    dateRange,
    region ? regionName(region) : "All sales territories",
    valuationArea ? `Valuation ${valuationArea}` : null,
    search ? `SKU: ${search}` : null,
  ].filter(Boolean) as string[];

  const pageMeta = {
    portfolio: ["Portfolio overview", "See which SKUs are selling, reaching customers, returning, or waiting for recommendation evidence."],
    sku: ["SKU 360", "Trace each product through sales, buyer reach, stock, returns, and available recommendation evidence."],
    whitespace: ["Whitespace & penetration", "Compare observed SKU buyers with active customers in the selected sales territory."],
    regional: ["Regional performance", "Compare direct-dealer sales, buyers, returns, and sold SKUs by sales territory."],
    health: ["Model & data health", "Know what is connected, partially covered, or still blank in PostgreSQL."],
  }[view];

  const changeView = (nextView: View) => {
    setView(nextView);
    setSidebarOpen(false);
  };

  const openSku = (skuId: string) => {
    setSelectedSkuId(skuId);
    setView("sku");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetFilters = () => {
    setRegion("");
    setValuationArea("");
    setSearch("");
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span><strong>SKU Pulse</strong><small>Product mix intelligence</small></span>
        </div>
        <nav aria-label="Primary navigation">
          <p className="nav-label">ANALYSIS</p>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "nav-item active" : "nav-item"}
              onClick={() => changeView(item.id)}
              aria-current={view === item.id ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span><strong>{item.label}</strong><small>{item.helper}</small></span>
            </button>
          ))}
        </nav>
        <div className="sidebar-status">
          <div><span className="connection-dot" /><strong>Live PostgreSQL</strong></div>
          <p>Connected through n8n</p>
          <small>Latest source refresh<br />{dateTime(data?.generatedAt)}</small>
        </div>
        <div className="sidebar-user">
          <span>DK</span>
          <div><strong>Commercial analyst</strong><small>All available territories</small></div>
          <button aria-label="Open account menu">•••</button>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}

      <main>
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation" aria-expanded={sidebarOpen}>☰</button>
          <div className="breadcrumb"><span>SKU Visibility</span><b>/</b><strong>{pageMeta[0]}</strong></div>
          <div className="topbar-actions">
            <span className="live-chip">LIVE POSTGRESQL</span>
            <button className="ghost-button" onClick={() => setRefreshKey((value) => value + 1)}><span aria-hidden="true">↻</span> Refresh data</button>
            <button className="icon-button" aria-label="Data status" onClick={() => setView("health")}><span aria-hidden="true">○</span><i /></button>
          </div>
        </header>

        <section className="demo-notice live-source-notice" role="note">
          <span aria-hidden="true">✓</span>
          <p><strong>Live source:</strong> Sales, returns, customer geography and SAP valuation are read from PostgreSQL through n8n. Empty recommendation measures are intentionally left blank until exact cart and recommendation links arrive.</p>
          <button onClick={() => setView("health")}>Review data coverage →</button>
        </section>

        <section className="page-heading">
          <div>
            <p className="eyebrow">COMMERCIAL INTELLIGENCE · LIVE DATA</p>
            <h1>{pageMeta[0]}</h1>
            <p>{pageMeta[1]}</p>
          </div>
          <div className="heading-actions">
            <div className="freshness"><span className="connection-dot" /><span><strong>{loading ? "Refreshing" : "Live connection"}</strong><small>{dateTime(data?.generatedAt)}</small></span></div>
            <button className="secondary-button" disabled title="Export will be enabled after the reporting extract is approved">Export unavailable</button>
          </div>
        </section>

        <section className={`filter-panel ${showFilters ? "filter-open" : ""}`} aria-label="Global dashboard filters">
          <div className="filter-panel-head">
            <div><strong>Live analysis filters</strong><small>Territory, valuation area and SKU search query the PostgreSQL source. Unsupported dimensions remain blank.</small></div>
            <button className="mobile-filter-toggle" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
              {showFilters ? "Hide filters" : "Show filters"} <span>{activeFilters.length}</span>
            </button>
            <button className="reset-button" onClick={resetFilters}>Reset</button>
          </div>
          <div className="filters">
            <label><span>Date range</span><select value={dateRange} disabled><option>{dateRange}</option></select></label>
            <label><span>Date basis</span><select value="Invoice date" disabled><option>Invoice date</option></select></label>
            <label>
              <span>Region</span>
              <select value={region} onChange={(event) => setRegion(event.target.value)}>
                <option value="">All sales territories</option>
                {(data?.regions ?? []).map((item) => <option value={item} key={item}>{regionName(item)}</option>)}
              </select>
            </label>
            <label><span>Category</span><select value="" disabled><option value="">Awaiting category master</option></select></label>
            <label><span>Line type</span><select value="Sales + returns" disabled><option>Sales + returns</option></select></label>
            <label>
              <span>Valuation area</span>
              <select value={valuationArea} onChange={(event) => setValuationArea(event.target.value)}>
                <option value="">All valuation areas</option>
                {(data?.valuationAreas ?? []).map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="search-label">
              <span>SKU search</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ID or product name" />
            </label>
          </div>
          <div className="active-filter-row">
            <span>Active</span>
            {activeFilters.map((filter) => <span className="filter-chip" key={filter}>{filter}</span>)}
            <small>{number(summary?.invoiceLines)} invoice lines · {number(data?.pagination.total)} matching products</small>
          </div>
        </section>

        <div className="page-content">
          {error ? (
            <section className="load-state error-state"><strong>Live data is temporarily unavailable.</strong><span>{error}</span><button onClick={() => setRefreshKey((value) => value + 1)}>Try again</button></section>
          ) : loading && !data ? (
            <section className="load-state"><strong>Loading the live SKU platform…</strong><span>Reading PostgreSQL through the n8n data service.</span></section>
          ) : data ? (
            <>
              {view === "portfolio" && <PortfolioView data={data} items={items} openSku={openSku} region={region} />}
              {view === "sku" && selectedItem && <SkuView data={data} item={selectedItem} items={items} setSelectedSkuId={setSelectedSkuId} region={region} />}
              {view === "whitespace" && <WhitespaceView data={data} items={items} openSku={openSku} region={region} />}
              {view === "regional" && <RegionalView data={data} selectedRegion={region} />}
              {view === "health" && <HealthView data={data} />}
            </>
          ) : null}
        </div>

        <footer>
          <span>SKU Pulse · Product Mix Visibility</span>
          <span>Live PostgreSQL · Unavailable measures remain blank</span>
          <button onClick={() => setView("health")}>Metric definitions</button>
        </footer>
      </main>
    </div>
  );
}

function PortfolioView({
  data,
  items,
  openSku,
  region,
}: {
  data: DashboardData;
  items: Product[];
  openSku: (id: string) => void;
  region: string;
}) {
  const { summary } = data;
  const maxSales = Math.max(...items.map((item) => item.net_sales_value), 1);
  const trendValues = data.monthlySales.map((item) => item.net_sales);
  return (
    <>
      <div className="basis-strip">
        <div><BasisTag>Exact ERP invoice measures</BasisTag><span>Sales · returns · invoices · quantities</span></div>
        <div><BasisTag tone="proxy">Observed customer proxy</BasisTag><span>Buyer penetration and whitespace within active direct dealers</span></div>
        <div><BasisTag tone="missing">Awaiting exact linkage</BasisTag><span>Recommendation exposure, acceptance and capture</span></div>
      </div>

      <section className="kpi-grid">
        <KpiCard label="SKUs sold" value={number(summary.soldProducts)} detail={`${number(summary.activeProducts)} active product records`} basis="POSITIVE SALES" />
        <KpiCard label="Active buyers" value={number(summary.activeMarketCustomers)} detail={`${number(summary.invoices)} invoices in scope`} tone="positive" basis="DISTINCT CUSTOMERS" />
        <KpiCard label="Net sales" value={money(summary.netSales)} detail={`${money(summary.grossSales)} gross positive value`} tone="positive" basis="ERP DIRECT DEALER" />
        <KpiCard label="Returns" value={money(summary.returnsValue)} detail={`${pct(summary.returnRatePct)} of gross sales value`} tone={summary.returnRatePct && summary.returnRatePct > 5 ? "warning" : "neutral"} basis="SIGNED RETURNS" />
        <KpiCard label="Recommendation acceptance" value="—" detail="No exact cart / recommendation link in invoice data" basis="AWAITING DATA" />
        <KpiCard label="Customer geocoding" value={pct(summary.geoCoveragePct)} detail={`${number(summary.geocodedSalesCustomers)} of ${number(summary.salesCustomers)} sales customers`} basis="LOCATION COVERAGE" />
      </section>

      <section className="two-column">
        <article className="card">
          <SectionHeader eyebrow="SALES JOURNEY" title="Gross sales to net result" subtitle="Returns remain separate and are never hidden inside acceptance." action={<BasisTag>Live invoices</BasisTag>} />
          <div className="funnel">
            {[
              ["Gross sales", summary.grossSales, 100, `${number(summary.invoiceLines)} invoice lines`],
              ["Net sales", summary.netSales, summary.grossSales ? summary.netSales / summary.grossSales * 100 : 0, `${money(summary.returnsValue)} returned`],
              ["Net quantity", summary.netQuantity, 72, "Signed sales and return quantity"],
              ["Recommendation accepted", null, 8, "Awaiting exact cart / recommendation linkage"],
            ].map(([label, value, width, note], index) => (
              <div className="funnel-row" key={String(label)}>
                <span className="funnel-index">{index + 1}</span>
                <div>
                  <div className="funnel-meta"><strong>{label}</strong><b>{value === null ? "—" : index === 2 ? number(Number(value)) : money(Number(value))}</b></div>
                  <div className="funnel-track"><i className={value === null ? "blank-bar" : ""} style={{ width: `${Math.max(Number(width), 5)}%` }} /></div>
                  <small>{note}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="funnel-foot"><span><i className="legend pending" /> {number(summary.invoices)} invoices</span><span><i className="legend rejected" /> {pct(summary.returnRatePct)} return rate</span></div>
        </article>

        <article className="card">
          <SectionHeader eyebrow="PORTFOLIO POSITION" title="Buyer penetration × net sales" subtitle="Bubble size represents live net sales value." action={<BasisTag tone="proxy">Observed basis</BasisTag>} />
          <div className="scatter">
            <span className="quadrant-label q1">Scaled reach</span><span className="quadrant-label q2">High value · low reach</span>
            <span className="quadrant-label q3">Whitespace priority</span><span className="quadrant-label q4">Broad reach</span>
            <span className="axis-label axis-y">Net sales rank →</span><span className="axis-label axis-x">Observed buyer penetration →</span>
            {items.slice(0, 40).map((item) => {
              const salesPosition = item.net_sales_value > 0 ? Math.max(7, item.net_sales_value / maxSales * 86) : 7;
              const size = Math.max(15, Math.min(32, 14 + Math.log10(Math.max(item.net_sales_value, 1))));
              return (
                <button
                  key={item.product_id}
                  className={`scatter-dot ${item.return_rate_pct && item.return_rate_pct > 5 ? "dot-down" : ""}`}
                  style={{ left: `${Math.min(Math.max(item.buyer_penetration_pct ?? 0, 5), 92)}%`, bottom: `${salesPosition}%`, width: size, height: size }}
                  title={`${item.product_id}: ${pct(item.buyer_penetration_pct)} buyer penetration, ${money(item.net_sales_value)} net sales`}
                  onClick={() => openSku(item.product_id)}
                ><span>{item.product_id.slice(0, 3)}</span></button>
              );
            })}
          </div>
          <div className="chart-legend"><span><i className="legend dot-blue" /> Live SKU</span><span><i className="legend dot-red" /> Return rate above 5%</span><small><BasisTag tone="proxy">Buyer proxy</BasisTag></small></div>
        </article>
      </section>

      <section className="card table-card">
        <SectionHeader eyebrow="SKU SCOREBOARD" title="Performance by product" subtitle={`Ranked by live net sales within ${region ? regionName(region) : "all sales territories"}. Blank recommendation fields are not inferred.`} action={<BasisTag>PostgreSQL</BasisTag>} />
        <div className="table-scroll">
          <table>
            <caption>Live SKU sales, penetration and recommendation data availability</caption>
            <thead><tr><th>SKU</th><th>Recommendation success</th><th>Invoices</th><th>Net quantity</th><th>Acceptance</th><th>Returns</th><th>Whitespace</th><th>Observed penetration</th><th>Net sales</th><th>Stock</th><th /></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.product_id}>
                  <td><button className="sku-cell" onClick={() => openSku(item.product_id)}><span>{item.product_id.slice(0, 2)}</span><b>{item.product_name || "Description unavailable"}<small>{item.product_id} · {item.category || "Category blank"}</small></b></button></td>
                  <td><Blank label="Awaiting outcome link" /></td>
                  <td><strong>{number(item.invoice_count)}</strong><small>{number(item.sales_line_count)} lines</small></td>
                  <td><strong>{number(item.net_quantity)}</strong><small>{number(item.return_quantity)} returned</small></td>
                  <td><strong>—</strong><small>cart / rec ID required</small></td>
                  <td><strong>{money(item.returns_value)}</strong><small>{pct(item.return_rate_pct)} of gross</small></td>
                  <td><strong>{number(item.whitespace_customers)}</strong><small>active customers without purchase</small></td>
                  <td><strong>{pct(item.buyer_penetration_pct)}</strong><small>{number(item.buyer_count)} buyers</small></td>
                  <td><strong>{money(item.net_sales_value)}</strong><MiniBars values={trendValues} accent={item.return_rate_pct && item.return_rate_pct > 5 ? "amber" : "blue"} /></td>
                  <td><strong>{decimal(item.total_stock)}</strong><small>Cost {decimal(item.selected_cost)}</small></td>
                  <td><button className="row-arrow" onClick={() => openSku(item.product_id)} aria-label={`Open ${item.product_name || item.product_id}`}>→</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-foot"><span>Showing {number(items.length)} of {number(data.pagination.total)} matching products · live filters applied</span><span><BasisTag>Sales exact</BasisTag> <BasisTag tone="proxy">Penetration proxy</BasisTag></span></div>
      </section>

      <section className="card table-card matrix-card">
        <SectionHeader eyebrow="REGION × SKU" title="Acceptance heatmap" subtitle="The original matrix remains in place; cells stay blank until exact recommendation outcomes are stored." action={<BasisTag tone="missing">Awaiting linkage</BasisTag>} />
        <div className="table-scroll">
          <table className="heatmap">
            <caption>Recommendation acceptance by SKU and sales territory</caption>
            <thead><tr><th>Region</th>{items.slice(0, 6).map((item) => <th key={item.product_id}>{item.product_id}</th>)}<th>Region signal</th></tr></thead>
            <tbody>
              {(region ? [region] : data.regions.slice(0, 8)).map((regionItem) => (
                <tr key={regionItem}>
                  <th>{regionName(regionItem)}<small>outcomes not linked</small></th>
                  {items.slice(0, 6).map((item) => <td key={item.product_id}><span className="heat-cell heat-empty">—</span></td>)}
                  <td><Blank /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function SkuView({
  data,
  item,
  items,
  setSelectedSkuId,
  region,
}: {
  data: DashboardData;
  item: Product;
  items: Product[];
  setSelectedSkuId: (id: string) => void;
  region: string;
}) {
  const maxMonth = Math.max(...data.monthlySales.map((month) => month.net_sales), 1);
  return (
    <>
      <section className="sku-hero card">
        <div className="sku-identity">
          <span className="product-tile">{item.product_id.slice(0, 2)}</span>
          <div>
            <div className="sku-title-row"><h2>{item.product_name || "Description unavailable"}</h2><span className="active-product">Active</span></div>
            <p>{item.product_id} · {item.category || "Category blank"} · UOM blank</p>
            <div className="identity-meta">
              <span>Observed unit value <strong>{money(item.observed_unit_price)}</strong></span>
              <span>Selected cost <strong>{decimal(item.selected_cost)}</strong></span>
              <span>Valuation areas <strong>{number(item.valuation_area_count)}</strong></span>
            </div>
          </div>
        </div>
        <div className="sku-selector">
          <label htmlFor="sku-select">Selected SKU</label>
          <select id="sku-select" value={item.product_id} onChange={(event) => setSelectedSkuId(event.target.value)}>
            {items.map((sku) => <option value={sku.product_id} key={sku.product_id}>{sku.product_id} · {sku.product_name || "No description"}</option>)}
          </select>
          <Blank label="Acceptance pending" />
        </div>
      </section>

      <div className="basis-strip">
        <div><BasisTag>Sales: exact</BasisTag><span>{number(item.invoice_count)} invoices · {money(item.net_sales_value)} net sales</span></div>
        <div><BasisTag tone="proxy">Penetration: observed</BasisTag><span>{number(item.buyer_count)} SKU buyers / {number(data.summary.activeMarketCustomers)} active buyers</span></div>
        <div><BasisTag tone="missing">Acceptance blank</BasisTag><span>Invoice does not contain exact recommendation identity</span></div>
      </div>

      <section className="kpi-grid sku-kpis">
        <KpiCard label="Net sales" value={money(item.net_sales_value)} detail={`${number(item.invoice_count)} invoices`} tone="positive" basis="ERP INVOICE" />
        <KpiCard label="Net quantity" value={number(item.net_quantity)} detail={`${number(item.return_quantity)} returned units`} basis="SIGNED QUANTITY" />
        <KpiCard label="Buyer penetration" value={pct(item.buyer_penetration_pct)} detail={`${number(item.buyer_count)} active SKU buyers`} basis="OBSERVED PROXY" />
        <KpiCard label="Whitespace customers" value={number(item.whitespace_customers)} detail="Active customers without a positive purchase" basis="OBSERVED PROXY" />
        <KpiCard label="Returns" value={money(item.returns_value)} detail={`${pct(item.return_rate_pct)} of gross sales`} tone={item.return_rate_pct && item.return_rate_pct > 5 ? "warning" : "neutral"} basis="ERP RETURN" />
        <KpiCard label="Recommendation acceptance" value="—" detail="Requires exact cart_id / rec_id linkage" basis="AWAITING DATA" />
      </section>

      <section className="two-column sku-charts">
        <article className="card">
          <SectionHeader eyebrow="TRAJECTORY" title="Recommendation conversion" subtitle="The original conversion chart remains blank until linked outcomes exist." action={<BasisTag tone="missing">No outcome fact</BasisTag>} />
          <div className="column-chart blank-chart" aria-label="Recommendation conversion unavailable">
            {[0, 0, 0, 0, 0, 0].map((_, index) => <div key={index}><span>—</span><i style={{ height: "6%" }} /><small>M{index + 1}</small></div>)}
          </div>
          <div className="chart-summary"><span><i className="legend dot-blue" /> Acceptance rate</span><strong>— <small>awaiting linkage</small></strong></div>
        </article>
        <article className="card">
          <SectionHeader eyebrow="LIVE INVOICES" title="Portfolio sell-in trend" subtitle={`Selected territory: ${region ? regionName(region) : "all sales territories"}. SKU-month detail is not yet materialized.`} action={<BasisTag>Live territory total</BasisTag>} />
          <div className="area-bars" aria-label="Monthly territory net sales">
            {data.monthlySales.map((month) => (
              <div key={month.month} style={{ height: `${Math.max(month.net_sales / maxMonth * 100, 8)}%` }}><i /><span>{money(month.net_sales)}</span></div>
            ))}
          </div>
          <div className="chart-summary"><span><i className="legend dot-green" /> Net sales</span><span><i className="legend dot-blue" /> Returns included</span><strong>{money(data.summary.netSales)}</strong></div>
        </article>
      </section>

      <section className="three-column">
        <article className="card">
          <SectionHeader eyebrow="PRODUCT MASTER" title="Valuation profile" subtitle="Live SAP valuation attributes." />
          <div className="availability-list compact-availability">
            <div><p><strong>Selected cost</strong><small>Normalized valuation cost</small></p><b>{decimal(item.selected_cost)}</b></div>
            <div><p><strong>Total stock</strong><small>Across loaded valuation areas</small></p><b>{decimal(item.total_stock)}</b></div>
            <div><p><strong>Valuation class</strong><small>Current product master rollup</small></p><b>{item.valuation_class || "—"}</b></div>
            <div><p><strong>Price control</strong><small>S standard · V moving average</small></p><b>{item.price_control || "—"}</b></div>
          </div>
        </article>
        <article className="card">
          <SectionHeader eyebrow="COMMERCIAL REACH" title="Where this SKU sells" subtitle="Live current-filter result." />
          <div className="rank-list">
            <div className="rank-row"><span className="rank-number">1</span><div><strong>{region ? regionName(region) : "All territories"}</strong><small>{number(item.sales_region_count)} territories with sales</small></div><div className="rank-meter"><i style={{ width: `${Math.min(item.buyer_penetration_pct ?? 0, 100)}%` }} /></div><b>{pct(item.buyer_penetration_pct)}</b></div>
            <div className="rank-row"><span className="rank-number">2</span><div><strong>Buyer count</strong><small>Distinct positive purchasers</small></div><div className="rank-meter"><i style={{ width: `${Math.min(item.buyer_penetration_pct ?? 0, 100)}%` }} /></div><b>{number(item.buyer_count)}</b></div>
            <div className="rank-row"><span className="rank-number">3</span><div><strong>Whitespace</strong><small>Active customers without purchase</small></div><div className="rank-meter"><i style={{ width: `${Math.min(100 - (item.buyer_penetration_pct ?? 0), 100)}%` }} /></div><b>{number(item.whitespace_customers)}</b></div>
          </div>
        </article>
        <article className="card">
          <SectionHeader eyebrow="NON-ACCEPTANCE" title="Recorded reasons" subtitle="No action or reason records are currently linked." action={<BasisTag tone="missing">Blank</BasisTag>} />
          <div className="reason-list">
            {["Price above expectation", "Existing stock on hand", "Customer declined trial", "UOM / pack-size mismatch", "Other / no reason"].map((label) => (
              <div key={label}><span><strong>{label}</strong><b>—</b></span><i><em style={{ width: "0%" }} /></i></div>
            ))}
          </div>
        </article>
      </section>

      <section className="card table-card">
        <SectionHeader eyebrow="AUDIT TRAIL" title="Recommendation evidence" subtitle={`Exact cart + recommendation + customer evidence for ${item.product_id}.`} action={<BasisTag tone="missing">No linked rows</BasisTag>} />
        <div className="table-scroll">
          <table><caption>Recommendation-to-invoice evidence</caption><thead><tr><th>Cart / recommendation</th><th>SKU</th><th>Customer</th><th>Region</th><th>Line type</th><th>Target</th><th>Actual</th><th>Outcome</th><th>Latency</th></tr></thead>
            <tbody><tr><td colSpan={9} className="empty-table-cell">No exact recommendation evidence is stored for this SKU yet.</td></tr></tbody>
          </table>
        </div>
        <div className="table-foot"><span>Fields remain blank until invoice_feedback links invoice_id, cart_id and rec_id.</span><BasisTag tone="missing">Not inferred</BasisTag></div>
      </section>

      <section className="provenance-card">
        <div><span aria-hidden="true">⌘</span><p><strong>Data provenance</strong><small>Direct-dealer invoice export · {shortDate(item.first_sale_date)}–{shortDate(item.last_sale_date)}</small></p></div>
        <div><span>Pricing</span><strong>Observed invoice value</strong></div>
        <div><span>Category</span><strong>{item.category || "Blank"}</strong></div>
        <div><span>Outcome confidence</span><strong>No linked evidence</strong></div>
      </section>
    </>
  );
}

function WhitespaceView({
  data,
  items,
  openSku,
  region,
}: {
  data: DashboardData;
  items: Product[];
  openSku: (id: string) => void;
  region: string;
}) {
  const visibleGaps = items.reduce((sum, item) => sum + item.whitespace_customers, 0);
  const penetrations = items.map((item) => item.buyer_penetration_pct).filter((value): value is number => value !== null);
  const averagePenetration = penetrations.length
    ? penetrations.reduce((sum, value) => sum + value, 0) / penetrations.length
    : null;
  return (
    <>
      <section className="metric-definition-banner">
        <div><span>1</span><p><strong>Active buyers</strong><small>Customers with a positive purchase in the selected territory.</small></p></div><i />
        <div><span>2</span><p><strong>SKU buyers</strong><small>Distinct active customers that purchased this SKU.</small></p></div><i />
        <div><span>3</span><p><strong>Observed whitespace</strong><small>Active buyers without a positive purchase of the SKU.</small></p></div><i />
        <div><span>4</span><p><strong>Recommendation capture</strong><small>Blank until exact recommendation outcomes are linked.</small></p></div>
      </section>

      <section className="kpi-grid">
        <KpiCard label="Active buying customers" value={number(data.summary.activeMarketCustomers)} detail={`Current scope: ${region ? regionName(region) : "all territories"}`} basis="OBSERVED MARKET" />
        <KpiCard label="Visible customer–SKU gaps" value={number(visibleGaps)} detail={`Across the ${number(items.length)} displayed SKUs`} basis="SUM OF SKU GAPS" />
        <KpiCard label="Average buyer penetration" value={pct(averagePenetration)} detail="Simple average across displayed SKUs" basis="OBSERVED PROXY" />
        <KpiCard label="Geocoded sales customers" value={number(data.summary.geocodedSalesCustomers)} detail={`${pct(data.summary.geoCoveragePct)} overall coverage`} basis="CUSTOMER LOCATION" />
        <KpiCard label="Captured trials" value="—" detail="Recommendation outcome table is empty" basis="AWAITING DATA" />
        <KpiCard label="Addressable penetration" value="—" detail="Authoritative local outlet universe is not connected" basis="ADDITIONAL DATA" />
      </section>

      <section className="two-column whitespace-lead">
        <article className="card">
          <SectionHeader eyebrow="OPPORTUNITY CONVERSION" title="Observed reach to recommendation capture" subtitle={`Current scope: ${region ? regionName(region) : "all sales territories"}`} action={<BasisTag tone="proxy">Mixed basis</BasisTag>} />
          <div className="stage-flow">
            {[
              ["Active buyers", data.summary.activeMarketCustomers, "Observed territory customer base"],
              ["Visible SKU gaps", visibleGaps, "Customer–SKU purchase gaps"],
              ["Recommended", null, "Awaiting recommendation exposure rows"],
              ["Captured", null, "Awaiting exact linked outcome"],
            ].map(([label, value, helper], index) => (
              <div key={String(label)} className="stage-node"><div><small>0{index + 1}</small><strong>{value === null ? "—" : number(Number(value))}</strong><span>{label}</span></div><p>{helper}</p></div>
            ))}
          </div>
          <div className="callout"><span aria-hidden="true">!</span><p><strong>Whitespace is observed within active direct dealers.</strong> It is not the complete local outlet market.</p></div>
        </article>
        <article className="card">
          <SectionHeader eyebrow="ACTION QUEUE" title="Highest whitespace headroom" subtitle="Live SKUs with the most active customers yet to purchase." />
          <div className="opportunity-list">
            {[...items].sort((a, b) => b.whitespace_customers - a.whitespace_customers).slice(0, 8).map((item, index) => (
              <button key={item.product_id} onClick={() => openSku(item.product_id)}>
                <span className="rank-number">{index + 1}</span>
                <span><strong>{item.product_name || "Description unavailable"}</strong><small>{item.product_id} · {item.category || "Category blank"}</small></span>
                <span><strong>{number(item.whitespace_customers)}</strong><small>customer gaps</small></span>
                <span><strong>{number(item.buyer_count)}</strong><small>buyers</small></span>
                <span><strong>{pct(item.buyer_penetration_pct)}</strong><small>penetration</small></span><b>→</b>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="card table-card">
        <SectionHeader eyebrow="OPPORTUNITY MATRIX" title="Whitespace by SKU" subtitle="The selected territory recalculates active buyers, observed penetration and customer gaps." action={<BasisTag tone="proxy">Observed proxy</BasisTag>} />
        <div className="table-scroll">
          <table className="whitespace-matrix">
            <caption>Observed whitespace opportunity by product</caption>
            <thead><tr><th>SKU</th><th>Territory</th><th>Active buyers</th><th>SKU buyers</th><th>Observed whitespace</th><th>Buyer penetration</th><th>Trial capture</th><th /></tr></thead>
            <tbody>{items.map((item) => (
              <tr key={item.product_id}>
                <td><strong>{item.product_name || "Description unavailable"}</strong><small>{item.product_id} · {item.category || "Category blank"}</small></td>
                <td>{region ? regionName(region) : "All territories"}</td>
                <td><strong>{number(data.summary.activeMarketCustomers)}</strong><small>selected market</small></td>
                <td><strong>{number(item.buyer_count)}</strong><small>positive purchasers</small></td>
                <td><span className={`opportunity-cell opp-${item.whitespace_customers >= 150 ? "high" : item.whitespace_customers >= 75 ? "mid" : "low"}`}><strong>{number(item.whitespace_customers)}</strong><small>without purchase</small></span></td>
                <td><strong>{pct(item.buyer_penetration_pct)}</strong><small>observed basis</small></td>
                <td><Blank /></td>
                <td><button className="row-arrow" onClick={() => openSku(item.product_id)} aria-label={`Open ${item.product_name || item.product_id}`}>→</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="card table-card">
        <SectionHeader eyebrow="CUSTOMER DRILLDOWN" title="Priority outlet opportunities" subtitle="Customer-level SKU opportunity rows are not yet materialized in PostgreSQL." action={<BasisTag tone="missing">Blank</BasisTag>} />
        <div className="table-scroll"><table><caption>Customer-level whitespace opportunities</caption><thead><tr><th>Customer</th><th>Region / cluster</th><th>Seed SKU</th><th>Peer penetration</th><th>Score</th><th>Capture state</th><th>Cooldown</th><th>Sales agent</th></tr></thead><tbody><tr><td colSpan={8} className="empty-table-cell">No customer-level recommendation opportunity rows are available yet.</td></tr></tbody></table></div>
      </section>

      <section className="unavailable-panel">
        <div><span aria-hidden="true">∅</span><p><strong>True local-market penetration is not yet measurable</strong><small>It requires the authoritative addressable outlet universe and stable market hierarchy.</small></p></div>
        <button disabled>Requires source integration</button>
      </section>
    </>
  );
}

function RegionalView({
  data,
  selectedRegion,
}: {
  data: DashboardData;
  selectedRegion: string;
}) {
  const regions = data.regionalSummary.filter((item) => !selectedRegion || item.region_label === selectedRegion);
  const maxSales = Math.max(...regions.map((item) => item.net_sales), 1);
  const totals = regions.reduce(
    (sum, item) => ({
      sales: sum.sales + item.net_sales,
      returns: sum.returns + item.returns_value,
      invoices: sum.invoices + item.invoices,
      lines: sum.lines + item.invoice_lines,
      buyers: sum.buyers + item.active_buyers,
    }),
    { sales: 0, returns: 0, invoices: 0, lines: 0, buyers: 0 },
  );
  return (
    <>
      <div className="basis-strip">
        <div><BasisTag>Sales: exact</BasisTag><span>ERP direct-dealer invoices grouped by territory</span></div>
        <div><BasisTag tone="proxy">Buyer reach: observed</BasisTag><span>Distinct positive purchasers inside each territory</span></div>
        <div><BasisTag tone="missing">Acceptance blank</BasisTag><span>No exact recommendation-to-invoice linkage</span></div>
      </div>

      <section className="kpi-grid">
        <KpiCard label="Regions in scope" value={number(regions.length)} detail={`${number(data.summary.salesRegions)} available sales territories`} basis="SALES TERRITORY" />
        <KpiCard label="Regional acceptance" value="—" detail="Exact recommendation outcomes are not linked" basis="AWAITING DATA" />
        <KpiCard label="Active buyers" value={number(totals.buyers)} detail="Summed territory-level distinct buyers" basis="OBSERVED" />
        <KpiCard label="Net sales" value={money(totals.sales)} detail={`${number(totals.invoices)} invoices`} tone="positive" basis="ERP INVOICE" />
        <KpiCard label="Returns" value={money(totals.returns)} detail={`${number(totals.lines)} invoice lines`} basis="SIGNED RETURN" />
        <KpiCard label="True sell-through" value="—" detail="Inventory receipts and downstream POS required" basis="ADDITIONAL DATA" />
      </section>

      <section className="regional-grid">
        {regions.map((item, index) => (
          <article className="region-card" key={item.region_label}>
            <div className="region-card-head"><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{regionName(item.region_label)}</h3><small>{number(item.active_buyers)} active buyers</small></div><b className={item.return_rate_pct && item.return_rate_pct > 5 ? "trend-down" : "trend-up"}>{pct(item.return_rate_pct)} returns</b></div>
            <div className="region-primary"><strong>{money(item.net_sales)}</strong><span>net sales<small>{number(item.invoices)} invoices</small></span></div>
            <div className="region-card-metrics">
              <div><span>Sold SKUs</span><strong>{number(item.sold_products)}</strong></div>
              <div><span>Active buyers</span><strong>{number(item.active_buyers)}</strong></div>
              <div><span>Geocoded buyers</span><strong>{number(item.geocoded_buyers)}</strong></div>
              <div><span>Acceptance</span><strong>—</strong></div>
            </div>
            <div className="region-bar"><i style={{ width: `${Math.max(item.net_sales / maxSales * 100, 2)}%` }} /></div>
          </article>
        ))}
      </section>

      <section className="two-column regional-analysis">
        <article className="card">
          <SectionHeader eyebrow="REGIONAL COMPARISON" title="Net sales and return rate" subtitle="Live sales performance; recommendation acceptance remains blank." action={<BasisTag>Exact sales</BasisTag>} />
          <div className="comparison-bars">
            {regions.map((item) => (
              <div key={item.region_label}>
                <span><strong>{regionName(item.region_label)}</strong><small>{number(item.invoices)} invoices</small></span>
                <div><i style={{ width: `${Math.max(item.net_sales / maxSales * 100, 1)}%` }} /><em style={{ width: `${Math.min(item.return_rate_pct ?? 0, 100)}%` }} /></div>
                <b>{money(item.net_sales)}</b>
              </div>
            ))}
          </div>
          <div className="chart-legend"><span><i className="legend dot-blue" /> Net sales</span><span><i className="legend dot-green" /> Return rate</span></div>
        </article>
        <article className="card">
          <SectionHeader eyebrow="SALES EXECUTION" title="Agent conversion signal" subtitle="Sales-rep names and linked recommendation outcomes are not available." />
          <div className="empty-visual"><Blank label="Awaiting sales-rep master and recommendation outcomes" /></div>
        </article>
      </section>

      <section className="card table-card">
        <SectionHeader eyebrow="REGION SCORECARD" title="Regional commercial performance" subtitle="Live direct-dealer sales and returns grouped by source territory." action={<BasisTag>PostgreSQL</BasisTag>} />
        <div className="table-scroll">
          <table>
            <caption>Regional sales performance</caption>
            <thead><tr><th>Region</th><th>Acceptance</th><th>Invoice lines</th><th>Active buyers</th><th>Sold SKUs</th><th>Net sales</th><th>Returns</th><th>Return rate</th><th>Geo coverage</th></tr></thead>
            <tbody>{regions.map((item) => (
              <tr key={item.region_label}>
                <td><strong>{regionName(item.region_label)}</strong><small>{item.region_label.split("|")[0].trim()}</small></td>
                <td><Blank /></td>
                <td><strong>{number(item.invoice_lines)}</strong><small>{number(item.invoices)} invoices</small></td>
                <td><strong>{number(item.active_buyers)}</strong><small>positive purchasers</small></td>
                <td><strong>{number(item.sold_products)}</strong><small>positive sales</small></td>
                <td><strong>{money(item.net_sales)}</strong><small>{number(item.net_quantity)} net quantity</small></td>
                <td><strong>{money(item.returns_value)}</strong><small>{pct(item.return_rate_pct)} of gross</small></td>
                <td><strong>{pct(item.return_rate_pct)}</strong></td>
                <td><strong>{item.active_buyers ? pct(item.geocoded_buyers / item.active_buyers * 100) : "—"}</strong><small>{number(item.geocoded_buyers)} buyers</small></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function HealthView({ data }: { data: DashboardData }) {
  const { summary, readiness } = data;
  return (
    <>
      <section className="health-hero live-health">
        <div className="health-state">
          <span className="health-icon health-ok" aria-hidden="true">✓</span>
          <div><p className="eyebrow">ENVIRONMENT STATE</p><h2>Live PostgreSQL connected through n8n</h2><p>Sales, returns, customer geography and SAP valuation are live. Recommendation outcomes and some master-data dimensions remain blank.</p></div>
        </div>
        <div className="health-meta">
          <div><span>API refreshed</span><strong>{dateTime(data.generatedAt)}</strong></div>
          <div><span>Invoice period</span><strong>{shortDate(summary.salesDateFrom)}–{shortDate(summary.salesDateTo)}</strong></div>
          <div><span>Source posture</span><strong>Production read-only API</strong></div>
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard label="Invoice lines" value={number(summary.invoiceLines)} detail={`${number(summary.invoices)} invoices`} tone="positive" basis="CONNECTED" />
        <KpiCard label="Products" value={number(summary.activeProducts)} detail={`${number(summary.describedProducts)} invoice-observed descriptions`} basis="PRODUCT MASTER" />
        <KpiCard label="Sales customers" value={number(summary.salesCustomers)} detail={`${number(summary.activeMarketCustomers)} active positive buyers`} basis="CUSTOMER MASTER" />
        <KpiCard label="Geography coverage" value={pct(summary.geoCoveragePct)} detail={`${number(summary.geocodedSalesCustomers)} geocoded sales customers`} tone={summary.geoCoveragePct === 100 ? "positive" : "warning"} basis="PARTIAL" />
        <KpiCard label="Recommendation feedback" value={number(summary.feedbackRecords)} detail="Exact outcomes stay blank until linked rows arrive" tone="warning" basis="EMPTY TABLE" />
        <KpiCard label="Valuation rows" value={number(summary.valuationRows)} detail={`${number(summary.pricedProducts)} products with cost`} tone="positive" basis="SAP MBEW" />
      </section>

      <section className="health-columns">
        <article className="card">
          <SectionHeader eyebrow="RELEASE GATE" title="Production readiness" subtitle="Current state of the original application data contract." action={<span className="gate-pill">2 PARTIAL · 2 BLANK</span>} />
          <div className="checklist">
            {[
              ["Live PostgreSQL schema", "Ready", "Operational tables and dashboard query were validated."],
              ["Sales & return invoices", "Ready", `${number(summary.invoiceLines)} lines reconcile to the supplied file.`],
              ["SAP valuation", "Ready", `${number(summary.valuationRows)} MBEW rows are loaded.`],
              ["Customer geography", "Pending", `${pct(summary.geoCoveragePct)} of sales customers currently have coordinates.`],
              ["Recommendation outcomes", "Blocked", "No exact cart / recommendation / invoice links are stored."],
              ["Authoritative outlet universe", "Blocked", "Required for true local-market penetration."],
            ].map(([title, state, detail]) => (
              <div className="check-row" key={title}>
                <span className={`check-icon check-${state.toLowerCase()}`}>{state === "Ready" ? "✓" : state === "Pending" ? "…" : "!"}</span>
                <div><strong>{title}</strong><small>{detail}</small></div>
                <b className={`check-label check-${state.toLowerCase()}`}>{state}</b>
              </div>
            ))}
          </div>
        </article>
        <article className="card">
          <SectionHeader eyebrow="DATA CONTRACT" title="Metric availability" subtitle="Unavailable fields remain blank in every view." />
          <div className="availability-list">
            <div><BasisTag>Exact now</BasisTag><p><strong>ERP invoice sales & returns</strong><small>Signed line values and quantities</small></p><b>Available</b></div>
            <div><BasisTag>Exact now</BasisTag><p><strong>SAP stock & cost</strong><small>Latest loaded MBEW valuation extract</small></p><b>Available</b></div>
            <div><BasisTag tone="proxy">Proxy</BasisTag><p><strong>Observed buyer penetration</strong><small>SKU buyers / active direct-dealer buyers</small></p><b>Directional</b></div>
            <div><BasisTag tone="proxy">Proxy</BasisTag><p><strong>Observed whitespace</strong><small>Active buyers without a positive SKU purchase</small></p><b>Directional</b></div>
            <div><BasisTag tone="missing">Blank</BasisTag><p><strong>Recommendation acceptance</strong><small>Needs exact cart_id and rec_id on invoice feedback</small></p><b>Unavailable</b></div>
            <div><BasisTag tone="missing">Blank</BasisTag><p><strong>True local-market penetration</strong><small>Needs authoritative outlet universe</small></p><b>Unavailable</b></div>
          </div>
        </article>
      </section>

      <section className="card table-card">
        <SectionHeader eyebrow="QUALITY MONITOR" title="Open data-quality issues" subtitle="Gaps remain visible and never receive mock or inferred values." action={<BasisTag tone="proxy">Live audit</BasisTag>} />
        <div className="table-scroll">
          <table>
            <caption>Live data quality issue register</caption>
            <thead><tr><th>Severity</th><th>Issue</th><th>Affected records</th><th>Metric impact</th><th>Recommended action</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td><span className="severity severity-high">High</span></td><td><strong>Recommendation outcome linkage absent</strong><small>invoice_feedback has no linked rows</small></td><td>{number(summary.feedbackRecords)}</td><td>Acceptance & capture</td><td>Persist cart_id and rec_id with invoice outcome</td><td>{readiness.recommendationOutcomes ? "Resolved" : "Open"}</td></tr>
              <tr><td><span className="severity severity-medium">Medium</span></td><td><strong>Customer coordinates incomplete</strong><small>Sales customers without geography</small></td><td>{number(summary.salesCustomers - summary.geocodedSalesCustomers)}</td><td>Map completeness</td><td>Load the remaining customer locations</td><td>Open</td></tr>
              <tr><td><span className="severity severity-medium">Medium</span></td><td><strong>Category and UOM blank</strong><small>Invoice export supplies product descriptions only</small></td><td>{number(summary.activeProducts)}</td><td>Category filtering</td><td>Load authoritative product attributes</td><td>Open</td></tr>
              <tr><td><span className="severity severity-low">Low</span></td><td><strong>Unassigned sales territory</strong><small>Source contains “Not assigned” rows</small></td><td>1 territory</td><td>Regional attribution</td><td>Resolve source territory assignment</td><td>Open</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="connection-roadmap">
        <SectionHeader eyebrow="DATA READINESS" title="Connections needed for the complete platform" subtitle="The application is live now; these sources progressively populate its remaining blank fields." />
        <div>
          {[
            ["01", "Sales, returns & valuation", "Connected PostgreSQL invoice and SAP MBEW data", "Live"],
            ["02", "Remaining customer geography", "Complete the 54 currently ungeocoded sales customers", "Partial"],
            ["03", "Recommendation outcome linkage", "Exact cart, recommendation and invoice IDs", "Required"],
            ["04", "Product attributes", "Category, UOM, lifecycle and governed selling price", "Required"],
            ["05", "Outlet & market universe", "Stable hierarchy and addressable outlet denominator", "Penetration"],
          ].map(([num, title, detail, tag]) => (
            <article key={num}><span>{num}</span><div><strong>{title}</strong><small>{detail}</small></div><b>{tag}</b></article>
          ))}
        </div>
      </section>
    </>
  );
}
