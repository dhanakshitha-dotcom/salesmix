"use client";

import {
  type ReactNode,
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import {
  DEPARTMENT_VIEW_OPTIONS,
  type DepartmentView,
} from "./department-views";

type View = "portfolio" | "sku" | "whitespace" | "regional" | "health";
type MetricMode = "count" | "value";

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
  sales_trend_pct: number | null;
  buyer_penetration_pct: number | null;
  whitespace_customers: number;
  familiar_profile_count: number;
  whitespace_trial_profile_count: number;
  graduated_profile_count: number | null;
};

type Summary = {
  activeProducts: number;
  pricedProducts: number;
  describedProducts: number;
  categorizedProducts: number;
  salesUnitProducts: number;
  grossMarginProducts: number;
  activeProfiles: number;
  learningStates: number;
  activeModelVersion: string | null;
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
  recommendationLines: number;
  whitespaceTrialLines: number;
  graduatedLines: number;
  recommendedValue: number;
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
    profiles: boolean;
    grossMargin: boolean;
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
  const [departmentView, setDepartmentView] =
    useState<DepartmentView>("executive");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [region, setRegion] = useState("");
  const [valuationArea, setValuationArea] = useState("");
  const [search, setSearch] = useState("");
  const [selectedSkuId, setSelectedSkuId] = useState("");
  const [metricMode, setMetricMode] = useState<MetricMode>("count");
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
  const departmentMeta =
    DEPARTMENT_VIEW_OPTIONS.find((item) => item.id === departmentView) ??
    DEPARTMENT_VIEW_OPTIONS[0];

  const activeFilters = [
    dateRange,
    region ? regionName(region) : "All sales territories",
    valuationArea ? `Valuation ${valuationArea}` : null,
    search ? `SKU: ${search}` : null,
  ].filter(Boolean) as string[];

  const pageMeta = departmentView === "executive"
    ? {
        portfolio: ["Portfolio overview", "See which SKUs are selling, reaching customers, returning, or waiting for recommendation evidence."],
        sku: ["SKU 360", "Trace each product through sales, buyer reach, stock, returns, and available recommendation evidence."],
        whitespace: ["Whitespace & penetration", "Compare observed SKU buyers with active customers in the selected sales territory."],
        regional: ["Regional performance", "Compare direct-dealer sales, buyers, returns, and sold SKUs by sales territory."],
        health: ["Model & data health", "Know what is connected, partially covered, or still blank in PostgreSQL."],
      }[view]
    : [departmentMeta.title, departmentMeta.subtitle];

  const changeView = (nextView: View) => {
    setView(nextView);
    setSidebarOpen(false);
  };

  const openSku = (skuId: string) => {
    setSelectedSkuId(skuId);
    if (departmentView === "executive") setView("sku");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetFilters = () => {
    setRegion("");
    setValuationArea("");
    setSearch("");
  };

  return (
    <div className={`app-shell role-${departmentView}`}>
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span><strong>SKU Pulse</strong><small>Product mix intelligence</small></span>
        </div>
        <nav aria-label="Primary navigation">
          <p className="nav-label">ANALYSIS</p>
          {departmentView === "executive" ? (
            NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={view === item.id ? "nav-item active" : "nav-item"}
                onClick={() => changeView(item.id)}
                aria-current={view === item.id ? "page" : undefined}
              >
                <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                <span><strong>{item.label}</strong><small>{item.helper}</small></span>
              </button>
            ))
          ) : (
            <button
              className="nav-item active department-nav-item"
              aria-current="page"
              aria-label={`${departmentMeta.shortLabel} decision workspace`}
            >
              <span className="nav-icon" aria-hidden="true">{departmentMeta.icon}</span>
              <span><strong>{departmentMeta.shortLabel}</strong><small>Decision workspace</small></span>
            </button>
          )}
        </nav>
        <div className="sidebar-status">
          <div><span className="connection-dot" /><strong>Live PostgreSQL</strong></div>
          <p>Connected through n8n</p>
          <small>Latest source refresh<br />{dateTime(data?.generatedAt)}</small>
        </div>
        <div className="sidebar-user">
          <span>DK</span>
          <div><strong>{departmentMeta.roleLabel}</strong><small>{region ? regionName(region) : "All available territories"}</small></div>
          <button aria-label="Open account menu">•••</button>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}

      <main>
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation" aria-expanded={sidebarOpen}>☰</button>
          <div className="breadcrumb"><span>SKU Visibility</span><b>/</b><strong>{pageMeta[0]}</strong></div>
          <div className="topbar-actions">
            <label className="view-switcher">
              <span>View</span>
              <select
                aria-label="Dashboard view"
                value={departmentView}
                onChange={(event) =>
                  setDepartmentView(event.target.value as DepartmentView)
                }
              >
                {DEPARTMENT_VIEW_OPTIONS.map((item) => (
                  <option value={item.id} key={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <span className="live-chip">LIVE POSTGRESQL</span>
            <button className="ghost-button" onClick={() => setRefreshKey((value) => value + 1)}><span aria-hidden="true">↻</span> Refresh data</button>
            <button className="icon-button" aria-label="Data status" onClick={() => { setDepartmentView("executive"); setView("health"); }}><span aria-hidden="true">○</span><i /></button>
          </div>
        </header>

        <section className="demo-notice live-source-notice" role="note">
          <span aria-hidden="true">✓</span>
          <p><strong>Live source:</strong> Sales, returns, customer geography and SAP valuation are read from PostgreSQL through n8n. Empty recommendation measures are intentionally left blank until exact cart and recommendation links arrive.</p>
          <button onClick={() => { setDepartmentView("executive"); setView("health"); }}>Review data coverage →</button>
        </section>

        <section className="page-heading">
          <div>
            <p className="eyebrow">{departmentView === "executive" ? "COMMERCIAL INTELLIGENCE · LIVE DATA" : `${departmentMeta.roleLabel} · LIVE DECISION VIEW`}</p>
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
              {departmentView === "executive" ? (
                <>
                  {view === "portfolio" && <PortfolioView data={data} items={items} openSku={openSku} region={region} metricMode={metricMode} setMetricMode={setMetricMode} />}
                  {view === "sku" && selectedItem && <SkuView data={data} item={selectedItem} items={items} setSelectedSkuId={setSelectedSkuId} region={region} />}
                  {view === "whitespace" && <WhitespaceView data={data} items={items} openSku={openSku} region={region} />}
                  {view === "regional" && <RegionalView data={data} selectedRegion={region} />}
                  {view === "health" && <HealthView data={data} />}
                </>
              ) : (
                <DepartmentWorkspace
                  role={departmentView}
                  data={data}
                  items={items}
                  selectedItem={selectedItem}
                  setSelectedSkuId={setSelectedSkuId}
                  openSku={openSku}
                  region={region}
                />
              )}
            </>
          ) : null}
        </div>

        <footer>
          <span>SKU Pulse · Product Mix Visibility</span>
          <span>Live PostgreSQL · Unavailable measures remain blank</span>
          <button onClick={() => { setDepartmentView("executive"); setView("health"); }}>Metric definitions</button>
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
  metricMode,
  setMetricMode,
}: {
  data: DashboardData;
  items: Product[];
  openSku: (id: string) => void;
  region: string;
  metricMode: MetricMode;
  setMetricMode: (mode: MetricMode) => void;
}) {
  const { summary } = data;
  const maxSales = Math.max(...items.map((item) => item.net_sales_value), 1);
  const trendValues = data.monthlySales.map((item) => item.net_sales);
  const journeyRows: [string, number | null, number, string][] = metricMode === "count"
    ? [
        ["Recommended", summary.recommendationLines || null, 100, "All issued recommendation lines"],
        ["Evaluated", null, 68, "Awaiting linked invoice feedback"],
        ["Invoice accepted", null, 42, "Awaiting exact cart / recommendation linkage"],
        ["Repeat purchase", null, 18, "Awaiting a linked follow-up purchase"],
      ]
    : [
        ["Recommended", summary.recommendedValue || null, 100, "Planned mix value from issued carts"],
        ["Evaluated", null, 68, "Awaiting linked invoice feedback"],
        ["Invoice accepted", null, 42, "Awaiting exact matched invoice value"],
        ["Repeat purchase", null, 18, "Awaiting a linked follow-up purchase"],
      ];
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
          <SectionHeader
            eyebrow="RECOMMENDATION JOURNEY"
            title="From exposure to repeat sell-in"
            subtitle="Unavailable outcome stages remain blank and are never inferred from sales."
            action={
              <div className="segmented" aria-label="Funnel metric mode">
                <button className={metricMode === "count" ? "active" : ""} onClick={() => setMetricMode("count")} aria-pressed={metricMode === "count"}>Line count</button>
                <button className={metricMode === "value" ? "active" : ""} onClick={() => setMetricMode("value")} aria-pressed={metricMode === "value"}>Value</button>
              </div>
            }
          />
          <div className="funnel">
            {journeyRows.map(([label, value, width, note], index) => (
              <div className="funnel-row" key={String(label)}>
                <span className="funnel-index">{index + 1}</span>
                <div>
                  <div className="funnel-meta"><strong>{label}</strong><b>{value === null ? "—" : metricMode === "count" ? number(value) : money(value)}</b></div>
                  <div className="funnel-track"><i className={value === null ? "blank-bar" : ""} style={{ width: `${Math.max(Number(width), 5)}%` }} /></div>
                  <small>{note}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="funnel-foot"><span><i className="legend pending" /> {number(summary.recommendations)} issued cart</span><span><i className="legend rejected" /> {number(summary.feedbackRecords)} evaluated outcomes</span></div>
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
              const trendState = item.sales_trend_pct === null
                ? "unclassified"
                : item.sales_trend_pct < -5
                  ? "declining"
                  : item.sales_trend_pct > 5
                    ? "improving"
                    : "healthy";
              const trendClass = trendState === "declining"
                ? "dot-down"
                : trendState === "healthy"
                  ? "dot-proven"
                  : trendState === "unclassified"
                    ? "dot-unclassified"
                    : "dot-improving";
              return (
                <button
                  key={item.product_id}
                  className={`scatter-dot ${trendClass}`}
                  style={{ left: `${Math.min(Math.max(item.buyer_penetration_pct ?? 0, 5), 92)}%`, bottom: `${salesPosition}%`, width: size, height: size }}
                  title={`${item.product_id}: ${pct(item.buyer_penetration_pct)} buyer penetration, ${money(item.net_sales_value)} net sales, ${pct(item.sales_trend_pct)} H1 trend · ${trendState}`}
                  onClick={() => openSku(item.product_id)}
                ><span>{item.product_id.slice(0, 3)}</span></button>
              );
            })}
          </div>
          <div className="chart-legend"><span><i className="legend dot-red" /> Declining</span><span><i className="legend dot-blue" /> Improving</span><span><i className="legend dot-green" /> Healthy</span><small><BasisTag tone="proxy">Buyer proxy</BasisTag></small></div>
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
  const graduatedCount = item.graduated_profile_count ?? 0;
  const profileMixTotal =
    item.familiar_profile_count +
    item.whitespace_trial_profile_count +
    graduatedCount;
  const familiarPct = profileMixTotal
    ? item.familiar_profile_count / profileMixTotal * 100
    : 0;
  const whitespacePct = profileMixTotal
    ? item.whitespace_trial_profile_count / profileMixTotal * 100
    : 0;
  const graduatedPct = profileMixTotal
    ? graduatedCount / profileMixTotal * 100
    : 0;
  const donutBackground = profileMixTotal
    ? `conic-gradient(#3b82f6 0 ${familiarPct}%, #20b486 ${familiarPct}% ${familiarPct + whitespacePct}%, #f59e0b ${familiarPct + whitespacePct}% 100%)`
    : "#edf2f7";
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
          <SectionHeader eyebrow="ORIGINAL LINE TYPE" title="Recommendation mix" subtitle="SKU profile across live customer-product engine classifications." action={<BasisTag tone="proxy">Engine profile</BasisTag>} />
          <div className="donut-layout">
            <div className="donut" style={{ background: donutBackground }}>
              <span><strong>{number(profileMixTotal)}</strong><small>profile roles</small></span>
            </div>
            <ul className="donut-legend">
              <li><i className="legend dot-blue" /><span>Familiar<small>Replenishment profile</small></span><strong>{profileMixTotal ? pct(familiarPct) : "—"}</strong></li>
              <li><i className="legend dot-green" /><span>Whitespace trial<small>New-category seed</small></span><strong>{profileMixTotal ? pct(whitespacePct) : "—"}</strong></li>
              <li><i className="legend dot-amber" /><span>Graduated<small>Previously captured</small></span><strong>{item.graduated_profile_count === null ? "—" : pct(graduatedPct)}</strong></li>
            </ul>
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
        <div><span>1</span><p><strong>Eligible whitespace</strong><small>Stored SKU seed for a customer without a category purchase.</small></p></div><i />
        <div><span>2</span><p><strong>Exposed trial</strong><small>Actually issued as WHITESPACE_TRIAL.</small></p></div><i />
        <div><span>3</span><p><strong>Captured</strong><small>Positive value on the exact linked invoice.</small></p></div><i />
        <div><span>4</span><p><strong>Graduated</strong><small>Captured before a later recommendation.</small></p></div>
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
          <SectionHeader eyebrow="OPPORTUNITY CONVERSION" title="Stored seed to captured trial" subtitle={`Current scope: ${region ? regionName(region) : "all sales territories"}`} action={<BasisTag tone="proxy">Mixed basis</BasisTag>} />
          <div className="stage-flow">
            {[
              ["Eligible", visibleGaps, "Observed customer–SKU gap proxy"],
              ["Issued", data.summary.whitespaceTrialLines || null, "Issued WHITESPACE_TRIAL lines"],
              ["Evaluated", null, "Awaiting linked invoice feedback"],
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

type RoleWorkspace = Exclude<DepartmentView, "executive">;

type SuggestedAction = {
  tone: "growth" | "risk" | "control";
  label: string;
  title: string;
  signal: string;
  action: string;
  impact: string;
  basis: string;
};

const trendLabel = (value?: number | null) =>
  value === null || value === undefined
    ? "Unclassified"
    : value < -5
      ? "Declining"
      : value > 5
        ? "Improving"
        : "Healthy";

const sortBy = (
  items: Product[],
  getter: (item: Product) => number,
) => [...items].sort((a, b) => getter(b) - getter(a));

function buildSuggestedActions(
  role: RoleWorkspace,
  data: DashboardData,
  items: Product[],
  selectedItem: Product | null,
): SuggestedAction[] {
  const declining =
    sortBy(
      items.filter((item) => (item.sales_trend_pct ?? 0) < -5),
      (item) => item.net_sales_value,
    )[0] ?? selectedItem;
  const improving =
    sortBy(
      items.filter((item) => (item.sales_trend_pct ?? 0) > 5),
      (item) => item.whitespace_customers,
    )[0] ?? selectedItem;
  const whitespace =
    sortBy(items, (item) => item.whitespace_customers)[0] ?? selectedItem;
  const returnRisk =
    sortBy(items, (item) => item.returns_value)[0] ?? selectedItem;
  const stockRisk =
    sortBy(
      items.filter(
        (item) =>
          item.total_stock > 0 && (item.sales_trend_pct ?? 0) < -5,
      ),
      (item) => item.total_stock,
    )[0] ?? declining;
  const familiar =
    sortBy(items, (item) => item.familiar_profile_count)[0] ?? selectedItem;

  if (role === "sales-head") {
    return [
      {
        tone: "risk",
        label: "RECOVER",
        title: declining?.product_name || "Declining SKU review",
        signal: `${declining?.product_id || "SKU"} · ${pct(declining?.sales_trend_pct)} trend · ${money(declining?.net_sales_value)} net sales`,
        action: "Assign a regional recovery owner and review buyer loss, returns and stock before the next cycle.",
        impact: "Protects existing revenue while isolating the commercial cause of decline.",
        basis: "PostgreSQL invoices + Analytics workflow",
      },
      {
        tone: "growth",
        label: "EXPAND",
        title: whitespace?.product_name || "Whitespace expansion",
        signal: `${number(whitespace?.whitespace_customers)} observed customer gaps · ${pct(whitespace?.buyer_penetration_pct)} penetration`,
        action: "Issue targeted whitespace trials in the highest-gap territory through the Recommendation workflow.",
        impact: "Converts proven SKU demand into broader active-dealer reach.",
        basis: "Customer profiles + Recommendation workflow",
      },
      {
        tone: "risk",
        label: "PROTECT",
        title: returnRisk?.product_name || "Return leakage review",
        signal: `${money(returnRisk?.returns_value)} returned · ${pct(returnRisk?.return_rate_pct)} of gross sales`,
        action: "Hold broad expansion and open a joint Sales and R&D investigation by territory.",
        impact: "Prevents growth activity from amplifying returns or product-fit issues.",
        basis: "Signed invoice returns in PostgreSQL",
      },
      {
        tone: "control",
        label: "FIX EVIDENCE",
        title: "Recommendation outcomes are not linked",
        signal: `${number(data.summary.recommendations)} issued cart · ${number(data.summary.feedbackRecords)} linked outcomes`,
        action: "Require cart_id and rec_id on the resulting invoice feedback before measuring acceptance.",
        impact: "Turns Sales execution into auditable learning without inferring success.",
        basis: "Recommendation + Learning workflows",
      },
    ];
  }

  if (role === "sales-agent") {
    return [
      {
        tone: "growth",
        label: "TRIAL NEXT",
        title: whitespace?.product_name || "Priority whitespace SKU",
        signal: `${number(whitespace?.whitespace_customers)} active customers without purchase · ${pct(whitespace?.buyer_penetration_pct)} penetration`,
        action: "Use the issued product-mix recommendation as a WHITESPACE_TRIAL conversation in the selected territory.",
        impact: "Expands reach while keeping the trial tied to an auditable recommendation.",
        basis: "Customer Intelligence + Recommendation workflow",
      },
      {
        tone: "growth",
        label: "REPLENISH",
        title: familiar?.product_name || "Familiar replenishment SKU",
        signal: `${number(familiar?.familiar_profile_count)} Familiar profiles · ${decimal(familiar?.total_stock)} stock`,
        action: "Prioritise a replenishment call and confirm current governed price before quoting.",
        impact: "Protects repeat revenue on products already familiar to customers.",
        basis: "Product profiles + product master",
      },
      {
        tone: "risk",
        label: "PAUSE & CHECK",
        title: returnRisk?.product_name || "Return-risk SKU",
        signal: `${pct(returnRisk?.return_rate_pct)} return rate · ${number(returnRisk?.return_quantity)} returned quantity`,
        action: "Check pack, use-case, price and availability before proposing the SKU again.",
        impact: "Reduces repeat returns and unsuitable trial offers.",
        basis: "Signed invoice returns in PostgreSQL",
      },
      {
        tone: "control",
        label: "RECORD",
        title: "Outcome evidence is still blank",
        signal: `${number(data.summary.recommendationLines)} issued lines · ${number(data.summary.feedbackRecords)} evaluated outcomes`,
        action: "Preserve customer, cart, recommendation, SKU and line-type IDs when submitting the invoice result.",
        impact: "Enables acceptance reporting and lets the Learning workflow improve future mixes.",
        basis: "Recommendation + Learning workflows",
      },
    ];
  }

  if (role === "rnd") {
    return [
      {
        tone: "risk",
        label: "INVESTIGATE",
        title: returnRisk?.product_name || "Highest return signal",
        signal: `${money(returnRisk?.returns_value)} returned · ${pct(returnRisk?.return_rate_pct)} return rate`,
        action: "Review returned invoices and regional concentration; treat this as a signal, not a confirmed defect.",
        impact: "Separates product, application, packaging and execution causes before changing the SKU.",
        basis: "PostgreSQL sales and return lines",
      },
      {
        tone: "risk",
        label: "LIFECYCLE",
        title: stockRisk?.product_name || "Declining stocked SKU",
        signal: `${decimal(stockRisk?.total_stock)} stock · ${pct(stockRisk?.sales_trend_pct)} trend`,
        action: "Review specification, pack and replenishment; decide whether to correct, redistribute or rationalise.",
        impact: "Reduces obsolescence exposure while addressing the underlying product signal.",
        basis: "SAP MBEW + invoice trend",
      },
      {
        tone: "growth",
        label: "CONTROLLED TRIAL",
        title: improving?.product_name || "Trial candidate",
        signal: `${number(improving?.whitespace_customers)} whitespace customers · ${number(improving?.whitespace_trial_profile_count)} trial profiles`,
        action: "Run a controlled product/application trial and capture exact recommendation and invoice evidence.",
        impact: "Tests product fit before broader development or launch investment.",
        basis: "Product-mix profiles + Recommendation workflow",
      },
      {
        tone: "control",
        label: "MASTER DATA",
        title: "Complete product decision attributes",
        signal: `${number(data.summary.categorizedProducts)} categorized · ${number(data.summary.salesUnitProducts)} governed sales UOM`,
        action: "Load authoritative category, UOM and lifecycle attributes for product-level comparisons.",
        impact: "Improves trial design, order sizing and lifecycle decisions without invented attributes.",
        basis: "PostgreSQL product master",
      },
    ];
  }

  return [
    {
      tone: "risk",
      label: "RETURN LEAKAGE",
      title: returnRisk?.product_name || "Highest financial return exposure",
      signal: `${money(returnRisk?.returns_value)} returned · ${pct(returnRisk?.return_rate_pct)} return rate`,
      action: "Audit credit notes and regional concentration; send product-related exceptions to R&D.",
      impact: "Reduces value erosion from repeated returns.",
      basis: "Signed PostgreSQL invoice values",
    },
    {
      tone: "risk",
      label: "REVENUE RECOVERY",
      title: declining?.product_name || "Declining revenue SKU",
      signal: `${money(declining?.net_sales_value)} net sales · ${pct(declining?.sales_trend_pct)} trend`,
      action: "Review historical price realisation, availability and customer loss with Sales.",
      impact: "Protects material revenue before the decline becomes structural.",
      basis: "Invoice history + Analytics workflow",
    },
    {
      tone: "control",
      label: "STOCK CONTROL",
      title: stockRisk?.product_name || "Stocked declining SKU",
      signal: `${decimal(stockRisk?.total_stock)} stock · last sale ${shortDate(stockRisk?.last_sale_date)}`,
      action: "Review replenishment, transfer, clearance or provision using the governed valuation basis.",
      impact: "Reduces slow-moving stock exposure without inventing currency value.",
      basis: "SAP MBEW + invoice dates",
    },
    {
      tone: "control",
      label: "PROFITABILITY BASIS",
      title: "Gross profit remains unavailable",
      signal: `${number(data.summary.grossMarginProducts)} products with governed gross margin`,
      action: "Load compatible invoice and cost currencies before any GP, margin or price-cost decision.",
      impact: "Prevents financially invalid comparisons between unknown currency bases.",
      basis: "Finance control in Dashboard Data API",
    },
  ];
}

function DepartmentSourceStrip({
  role,
  data,
}: {
  role: RoleWorkspace;
  data: DashboardData;
}) {
  const roleLabel =
    DEPARTMENT_VIEW_OPTIONS.find((item) => item.id === role)?.roleLabel ?? role;
  return (
    <section className="department-banner">
      <div>
        <span className="department-emblem" aria-hidden="true">
          {DEPARTMENT_VIEW_OPTIONS.find((item) => item.id === role)?.icon}
        </span>
        <div>
          <p className="eyebrow">{roleLabel}</p>
          <h2>Decision view from the same governed product platform</h2>
          <p>PostgreSQL tables → n8n intelligence workflows → read-only dashboard API. No departmental copy or mock layer.</p>
        </div>
      </div>
      <div className="department-provenance">
        <span>Source</span><strong>{data.source}</strong>
        <span>Refreshed</span><strong>{dateTime(data.generatedAt)}</strong>
      </div>
    </section>
  );
}

function DepartmentActionPlan({
  actions,
}: {
  actions: SuggestedAction[];
}) {
  return (
    <section className="card department-actions">
      <SectionHeader
        eyebrow="SUGGESTED NEXT STEPS"
        title="Action plan"
        subtitle="Deterministic guidance from fields already visible in the Executive dashboard."
        action={<BasisTag tone="proxy">Decision support</BasisTag>}
      />
      <div className="action-card-grid">
        {actions.map((item) => (
          <article className={`action-card action-${item.tone}`} key={`${item.label}-${item.title}`}>
            <div><span>{item.label}</span><small>{item.basis}</small></div>
            <h3>{item.title}</h3>
            <p><strong>Signal</strong>{item.signal}</p>
            <p><strong>Do next</strong>{item.action}</p>
            <p><strong>How it helps</strong>{item.impact}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function DepartmentSkuSelector({
  item,
  items,
  setSelectedSkuId,
}: {
  item: Product;
  items: Product[];
  setSelectedSkuId: (id: string) => void;
}) {
  return (
    <section className="department-sku-selector card" id="department-sku-detail">
      <div className="sku-identity">
        <span className="product-tile">{item.product_id.slice(0, 2)}</span>
        <div>
          <div className="sku-title-row">
            <h2>{item.product_name || "Description unavailable"}</h2>
            <span className="active-product">Active</span>
          </div>
          <p>{item.product_id} · {item.category || "Category blank"} · UOM blank</p>
        </div>
      </div>
      <div className="sku-selector">
        <label htmlFor="department-sku-select">Selected SKU</label>
        <select
          id="department-sku-select"
          value={item.product_id}
          onChange={(event) => setSelectedSkuId(event.target.value)}
        >
          {items.map((sku) => (
            <option value={sku.product_id} key={sku.product_id}>
              {sku.product_id} · {sku.product_name || "No description"}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}

function ProductProfileCard({ item }: { item: Product }) {
  const graduatedCount = item.graduated_profile_count ?? 0;
  const total =
    item.familiar_profile_count +
    item.whitespace_trial_profile_count +
    graduatedCount;
  const familiar = total ? item.familiar_profile_count / total * 100 : 0;
  const whitespace = total
    ? item.whitespace_trial_profile_count / total * 100
    : 0;
  const background = total
    ? `conic-gradient(#3b82f6 0 ${familiar}%, #20b486 ${familiar}% ${familiar + whitespace}%, #f59e0b ${familiar + whitespace}% 100%)`
    : "#edf2f7";
  return (
    <article className="card">
      <SectionHeader
        eyebrow="PRODUCT-MIX ENGINE"
        title="Recommendation mix"
        subtitle="Familiar, Whitespace Trial and Graduated classifications stored in PostgreSQL."
        action={<BasisTag tone="proxy">n8n profile</BasisTag>}
      />
      <div className="donut-layout">
        <div className="donut" style={{ background }}>
          <span><strong>{number(total)}</strong><small>profiles</small></span>
        </div>
        <div className="donut-legend">
          <div><i className="dot-blue" /><span><strong>{number(item.familiar_profile_count)}</strong> Familiar<small>Replenishment profile</small></span></div>
          <div><i className="dot-green" /><span><strong>{number(item.whitespace_trial_profile_count)}</strong> Whitespace trial<small>New-category seed</small></span></div>
          <div><i className="dot-amber" /><span><strong>{number(item.graduated_profile_count)}</strong> Graduated<small>Previously captured</small></span></div>
        </div>
      </div>
    </article>
  );
}

function DepartmentScatter({
  items,
  openSku,
}: {
  items: Product[];
  openSku: (id: string) => void;
}) {
  const maxSales = Math.max(...items.map((item) => item.net_sales_value), 1);
  return (
    <article className="card">
      <SectionHeader
        eyebrow="GROWTH POSITION"
        title="Buyer penetration × net sales"
        subtitle="The Executive growth signal, retained for departmental decisions."
        action={<BasisTag tone="proxy">Observed basis</BasisTag>}
      />
      <div className="scatter">
        <span className="quadrant-label q1">Scaled reach</span>
        <span className="quadrant-label q2">High value · low reach</span>
        <span className="quadrant-label q3">Whitespace priority</span>
        <span className="quadrant-label q4">Broad reach</span>
        <span className="axis-label axis-y">Net sales rank →</span>
        <span className="axis-label axis-x">Observed buyer penetration →</span>
        {items.slice(0, 40).map((item) => {
          const salesPosition = item.net_sales_value > 0
            ? Math.max(7, item.net_sales_value / maxSales * 86)
            : 7;
          const size = Math.max(
            15,
            Math.min(32, 14 + Math.log10(Math.max(item.net_sales_value, 1))),
          );
          const state = trendLabel(item.sales_trend_pct);
          const trendClass =
            state === "Declining"
              ? "dot-down"
              : state === "Healthy"
                ? "dot-proven"
                : state === "Improving"
                  ? "dot-improving"
                  : "dot-unclassified";
          return (
            <button
              key={item.product_id}
              className={`scatter-dot ${trendClass}`}
              style={{
                left: `${Math.min(Math.max(item.buyer_penetration_pct ?? 0, 5), 92)}%`,
                bottom: `${salesPosition}%`,
                width: size,
                height: size,
              }}
              title={`${item.product_id}: ${pct(item.buyer_penetration_pct)} buyer penetration, ${money(item.net_sales_value)} net sales, ${state}`}
              onClick={() => openSku(item.product_id)}
            >
              <span>{item.product_id.slice(0, 3)}</span>
            </button>
          );
        })}
      </div>
      <div className="chart-legend">
        <span><i className="legend dot-red" /> Declining</span>
        <span><i className="legend dot-blue" /> Improving</span>
        <span><i className="legend dot-green" /> Healthy</span>
      </div>
    </article>
  );
}

function SalesHeadWorkspace({
  data,
  items,
  openSku,
  actions,
}: {
  data: DashboardData;
  items: Product[];
  openSku: (id: string) => void;
  actions: SuggestedAction[];
}) {
  const { summary } = data;
  return (
    <>
      <section className="kpi-grid">
        <KpiCard label="Net sales" value={money(summary.netSales)} detail={`${money(summary.grossSales)} gross sales`} tone="positive" basis="ERP INVOICES" />
        <KpiCard label="Active buyers" value={number(summary.activeMarketCustomers)} detail={`${number(summary.invoices)} invoices`} basis="CUSTOMER REACH" />
        <KpiCard label="SKUs sold" value={number(summary.soldProducts)} detail={`${number(summary.activeProducts)} active products`} basis="PORTFOLIO" />
        <KpiCard label="Returns" value={money(summary.returnsValue)} detail={`${pct(summary.returnRatePct)} of gross sales`} tone={summary.returnRatePct && summary.returnRatePct > 5 ? "warning" : "neutral"} basis="RETURN RISK" />
        <KpiCard label="Issued mix lines" value={number(summary.recommendationLines)} detail={`${number(summary.whitespaceTrialLines)} whitespace trials`} basis="N8N RECOMMENDATION" />
        <KpiCard label="Geo coverage" value={pct(summary.geoCoveragePct)} detail={`${number(summary.geocodedSalesCustomers)} of ${number(summary.salesCustomers)} sales customers`} basis="TERRITORY COVERAGE" />
      </section>
      <section className="two-column department-lead-grid">
        <DepartmentScatter items={items} openSku={openSku} />
        <article className="card recommendation-ledger">
          <SectionHeader eyebrow="RECOMMENDATION EXECUTION" title="Mix pipeline" subtitle="Planned value remains pipeline until exact invoice linkage." />
          <div className="role-stage-grid">
            <div><span>Issued carts</span><strong>{number(summary.recommendations)}</strong><small>{number(summary.recommendationLines)} lines</small></div>
            <div><span>Whitespace trials</span><strong>{number(summary.whitespaceTrialLines)}</strong><small>engine-selected seeds</small></div>
            <div><span>Graduated</span><strong>{number(summary.graduatedLines)}</strong><small>stored profile lines</small></div>
            <div><span>Planned value</span><strong>{money(summary.recommendedValue)}</strong><small>not realised revenue</small></div>
            <div className="stage-blank"><span>Acceptance</span><strong>—</strong><small>{number(summary.feedbackRecords)} linked outcomes</small></div>
          </div>
        </article>
      </section>
      <DepartmentActionPlan actions={actions} />
      <section className="card table-card">
        <SectionHeader eyebrow="TERRITORY COMMAND" title="Regional growth and recovery" subtitle={`${number(summary.salesRegions)} sales territories from PostgreSQL.`} action={<BasisTag>Exact sales</BasisTag>} />
        <div className="table-scroll">
          <table>
            <caption>Sales Head regional decision table</caption>
            <thead><tr><th>Region</th><th>Net sales</th><th>Invoices</th><th>Active buyers</th><th>Sold SKUs</th><th>Returns</th><th>Return rate</th><th>Geo coverage</th></tr></thead>
            <tbody>{data.regionalSummary.map((item) => (
              <tr key={item.region_label}>
                <td><strong>{regionName(item.region_label)}</strong><small>{item.region_label.split("|")[0].trim()}</small></td>
                <td><strong>{money(item.net_sales)}</strong><small>{number(item.net_quantity)} net quantity</small></td>
                <td><strong>{number(item.invoices)}</strong><small>{number(item.invoice_lines)} lines</small></td>
                <td><strong>{number(item.active_buyers)}</strong></td>
                <td><strong>{number(item.sold_products)}</strong></td>
                <td><strong>{money(item.returns_value)}</strong></td>
                <td><strong>{pct(item.return_rate_pct)}</strong></td>
                <td><strong>{item.active_buyers ? pct(item.geocoded_buyers / item.active_buyers * 100) : "—"}</strong><small>{number(item.geocoded_buyers)} geocoded</small></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      <section className="card table-card">
        <SectionHeader eyebrow="SKU DIRECTION" title="Growth, reach and return signals" subtitle="The fields required to assign a SKU growth or recovery action." action={<BasisTag>PostgreSQL + n8n</BasisTag>} />
        <div className="table-scroll">
          <table>
            <caption>Sales Head SKU decision table</caption>
            <thead><tr><th>SKU</th><th>Trend</th><th>Net sales</th><th>Invoices / lines</th><th>Net / return qty</th><th>Buyer reach</th><th>Whitespace</th><th>Returns</th><th>Profile mix</th><th>Stock</th></tr></thead>
            <tbody>{items.slice(0, 60).map((item) => (
              <tr key={item.product_id}>
                <td><button className="sku-cell" onClick={() => openSku(item.product_id)}><span>{item.product_id.slice(0, 2)}</span><b>{item.product_name || "Description unavailable"}<small>{item.product_id} · {item.category || "Category blank"}</small></b></button></td>
                <td><strong>{trendLabel(item.sales_trend_pct)}</strong><small>{pct(item.sales_trend_pct)}</small></td>
                <td><strong>{money(item.net_sales_value)}</strong></td>
                <td><strong>{number(item.invoice_count)}</strong><small>{number(item.sales_line_count)} lines</small></td>
                <td><strong>{number(item.net_quantity)}</strong><small>{number(item.return_quantity)} returned</small></td>
                <td><strong>{pct(item.buyer_penetration_pct)}</strong><small>{number(item.buyer_count)} buyers</small></td>
                <td><strong>{number(item.whitespace_customers)}</strong></td>
                <td><strong>{money(item.returns_value)}</strong><small>{pct(item.return_rate_pct)}</small></td>
                <td><strong>{number(item.familiar_profile_count)} / {number(item.whitespace_trial_profile_count)} / {number(item.graduated_profile_count)}</strong><small>Familiar / Trial / Graduated</small></td>
                <td><strong>{decimal(item.total_stock)}</strong><small>{number(item.sales_region_count)} sales regions</small></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function SalesAgentWorkspace({
  data,
  items,
  selectedItem,
  setSelectedSkuId,
  openSku,
  actions,
  region,
}: {
  data: DashboardData;
  items: Product[];
  selectedItem: Product;
  setSelectedSkuId: (id: string) => void;
  openSku: (id: string) => void;
  actions: SuggestedAction[];
  region: string;
}) {
  return (
    <>
      <DepartmentSkuSelector item={selectedItem} items={items} setSelectedSkuId={setSelectedSkuId} />
      <section className="kpi-grid">
        <KpiCard label="SKU net sales" value={money(selectedItem.net_sales_value)} detail={`${number(selectedItem.invoice_count)} invoices · last ${shortDate(selectedItem.last_sale_date)}`} tone="positive" basis="ERP INVOICE" />
        <KpiCard label="Quantity" value={number(selectedItem.net_quantity)} detail={`${number(selectedItem.return_quantity)} returned`} basis="SIGNED QUANTITY" />
        <KpiCard label="Buyer reach" value={pct(selectedItem.buyer_penetration_pct)} detail={`${number(selectedItem.buyer_count)} buyers`} basis="OBSERVED PROXY" />
        <KpiCard label="Whitespace" value={number(selectedItem.whitespace_customers)} detail={`${region ? regionName(region) : "All territories"} active-customer gap`} basis="NEXT CALLS" />
        <KpiCard label="Stock" value={decimal(selectedItem.total_stock)} detail={`${money(selectedItem.observed_unit_price)} historical unit value`} basis="CHECK BEFORE QUOTE" />
        <KpiCard label="Recommendation outcome" value="—" detail={`${number(data.summary.recommendationLines)} issued lines · exact link required`} basis="AWAITING FEEDBACK" />
      </section>
      <section className="two-column">
        <DepartmentActionPlan actions={actions} />
        <ProductProfileCard item={selectedItem} />
      </section>
      <section className="card table-card field-action-table">
        <SectionHeader eyebrow="MY OPPORTUNITIES" title="Territory SKU action queue" subtitle="Ranked from existing whitespace, trend, reach, return and stock signals. Customer ownership is not invented." action={<BasisTag tone="proxy">Territory scoped</BasisTag>} />
        <div className="table-scroll">
          <table>
            <caption>Sales Agent SKU action queue</caption>
            <thead><tr><th>SKU</th><th>Next motion</th><th>Trend</th><th>Last sale</th><th>Buyers</th><th>Penetration</th><th>Whitespace</th><th>Returns</th><th>Stock</th><th>Outcome</th></tr></thead>
            <tbody>{sortBy(items, (item) => item.whitespace_customers).slice(0, 40).map((item) => {
              const motion =
                item.return_rate_pct && item.return_rate_pct > 5
                  ? "Pause & inspect"
                  : item.graduated_profile_count
                    ? "Repeat order"
                    : item.familiar_profile_count >= item.whitespace_trial_profile_count
                      ? "Replenish"
                      : "Whitespace trial";
              return (
                <tr key={item.product_id}>
                  <td><button className="sku-cell" onClick={() => openSku(item.product_id)}><span>{item.product_id.slice(0, 2)}</span><b>{item.product_name || "Description unavailable"}<small>{item.product_id} · {item.category || "Category blank"}</small></b></button></td>
                  <td><span className="motion-chip">{motion}</span></td>
                  <td><strong>{trendLabel(item.sales_trend_pct)}</strong><small>{pct(item.sales_trend_pct)}</small></td>
                  <td><strong>{shortDate(item.last_sale_date)}</strong><small>{number(item.invoice_count)} invoices</small></td>
                  <td><strong>{number(item.buyer_count)}</strong></td>
                  <td><strong>{pct(item.buyer_penetration_pct)}</strong></td>
                  <td><strong>{number(item.whitespace_customers)}</strong></td>
                  <td><strong>{pct(item.return_rate_pct)}</strong><small>{money(item.returns_value)}</small></td>
                  <td><strong>{decimal(item.total_stock)}</strong></td>
                  <td><Blank label="Record exact IDs" /></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </section>
      <section className="evidence-panel">
        <div>
          <span aria-hidden="true">◎</span>
          <p><strong>Outcome follow-up</strong><small>Customer, cart ID, recommendation ID, SKU, line type, target, actual, outcome, latency and recorded reason stay blank until exact linked feedback exists.</small></p>
        </div>
        <Blank label={`${number(data.summary.feedbackRecords)} linked outcomes`} />
      </section>
    </>
  );
}

function RndWorkspace({
  data,
  items,
  selectedItem,
  setSelectedSkuId,
  actions,
}: {
  data: DashboardData;
  items: Product[];
  selectedItem: Product;
  setSelectedSkuId: (id: string) => void;
  actions: SuggestedAction[];
}) {
  const { summary } = data;
  return (
    <>
      <DepartmentSkuSelector item={selectedItem} items={items} setSelectedSkuId={setSelectedSkuId} />
      <section className="lab-provenance">
        <span>MODEL</span><strong>{summary.activeModelVersion || "—"}</strong>
        <span>PROFILES</span><strong>{number(summary.activeProfiles)}</strong>
        <span>LEARNING STATES</span><strong>{number(summary.learningStates)}</strong>
        <span>MASTER COVERAGE</span><strong>{number(summary.categorizedProducts)} categorized · {number(summary.salesUnitProducts)} UOM</strong>
      </section>
      <section className="kpi-grid">
        <KpiCard label="Return signal" value={pct(selectedItem.return_rate_pct)} detail={`${money(selectedItem.returns_value)} · ${number(selectedItem.return_quantity)} returned`} tone={selectedItem.return_rate_pct && selectedItem.return_rate_pct > 5 ? "warning" : "neutral"} basis="NOT A CONFIRMED DEFECT" />
        <KpiCard label="Physical movement" value={number(selectedItem.net_quantity)} detail={`${number(selectedItem.gross_quantity)} gross quantity`} basis="ERP QUANTITY" />
        <KpiCard label="Demand trend" value={pct(selectedItem.sales_trend_pct)} detail={trendLabel(selectedItem.sales_trend_pct)} basis="H1 SIGNAL" />
        <KpiCard label="Buyer reach" value={pct(selectedItem.buyer_penetration_pct)} detail={`${number(selectedItem.buyer_count)} buyers · ${number(selectedItem.sales_region_count)} regions`} basis="OBSERVED PROXY" />
        <KpiCard label="Trial headroom" value={number(selectedItem.whitespace_customers)} detail={`${number(selectedItem.whitespace_trial_profile_count)} Whitespace Trial profiles`} basis="CONTROLLED TRIAL" />
        <KpiCard label="Stock" value={decimal(selectedItem.total_stock)} detail={`First ${shortDate(selectedItem.first_sale_date)} · last ${shortDate(selectedItem.last_sale_date)}`} basis="LIFECYCLE SIGNAL" />
      </section>
      <section className="two-column">
        <DepartmentActionPlan actions={actions} />
        <ProductProfileCard item={selectedItem} />
      </section>
      <section className="three-column department-diagnostics">
        <article className="card specimen-card">
          <SectionHeader eyebrow="PRODUCT SPECIMEN" title="Identity & lifecycle" />
          <div className="availability-list compact-availability">
            <div><p><strong>Product ID</strong><small>Common decision key</small></p><b>{selectedItem.product_id}</b></div>
            <div><p><strong>Category</strong><small>Model-derived where available</small></p><b>{selectedItem.category || "—"}</b></div>
            <div><p><strong>First sale</strong><small>Launch evidence</small></p><b>{shortDate(selectedItem.first_sale_date)}</b></div>
            <div><p><strong>Last sale</strong><small>Dormancy evidence</small></p><b>{shortDate(selectedItem.last_sale_date)}</b></div>
          </div>
        </article>
        <article className="card specimen-card">
          <SectionHeader eyebrow="DESIGN TO COST" title="Valuation context" />
          <div className="availability-list compact-availability">
            <div><p><strong>Selected cost</strong><small>Currency comparison not allowed</small></p><b>{decimal(selectedItem.selected_cost)}</b></div>
            <div><p><strong>Observed unit value</strong><small>Six-month invoice history</small></p><b>{money(selectedItem.observed_unit_price)}</b></div>
            <div><p><strong>Valuation class</strong><small>Product accounting context</small></p><b>{selectedItem.valuation_class || "—"}</b></div>
            <div><p><strong>Price control</strong><small>S standard · V moving</small></p><b>{selectedItem.price_control || "—"}</b></div>
            <div><p><strong>Valuation areas</strong><small>Loaded SAP coverage</small></p><b>{number(selectedItem.valuation_area_count)}</b></div>
          </div>
        </article>
        <article className="card specimen-card">
          <SectionHeader eyebrow="TRIAL EVIDENCE" title="Outcome readiness" />
          <div className="availability-list compact-availability">
            <div><p><strong>Recommendation acceptance</strong><small>Needs cart_id + rec_id</small></p><b>—</b></div>
            <div><p><strong>Recorded reason</strong><small>No linked reason rows</small></p><b>—</b></div>
            <div><p><strong>Trial capture</strong><small>No exact invoice outcome</small></p><b>—</b></div>
            <div><p><strong>Graduated evidence</strong><small>Stored profile count</small></p><b>{number(selectedItem.graduated_profile_count)}</b></div>
          </div>
        </article>
      </section>
      <section className="card table-card">
        <SectionHeader eyebrow="PRODUCT LAB QUEUE" title="Return, lifecycle and trial signals" subtitle="Signals guide investigation; they do not assert a defect or acceptance outcome." action={<BasisTag>PostgreSQL + model</BasisTag>} />
        <div className="table-scroll">
          <table>
            <caption>R and D product diagnostic table</caption>
            <thead><tr><th>SKU</th><th>Trend</th><th>Movement</th><th>Returns</th><th>Buyer reach</th><th>Whitespace</th><th>Profile mix</th><th>First / last sale</th><th>Stock</th><th>Valuation</th></tr></thead>
            <tbody>{sortBy(items, (item) => item.returns_value).slice(0, 60).map((item) => (
              <tr key={item.product_id}>
                <td><strong>{item.product_name || "Description unavailable"}</strong><small>{item.product_id} · {item.category || "Category blank"}</small></td>
                <td><strong>{trendLabel(item.sales_trend_pct)}</strong><small>{pct(item.sales_trend_pct)}</small></td>
                <td><strong>{number(item.net_quantity)}</strong><small>{number(item.gross_quantity)} gross</small></td>
                <td><strong>{pct(item.return_rate_pct)}</strong><small>{number(item.return_quantity)} qty · {money(item.returns_value)}</small></td>
                <td><strong>{pct(item.buyer_penetration_pct)}</strong><small>{number(item.buyer_count)} buyers</small></td>
                <td><strong>{number(item.whitespace_customers)}</strong></td>
                <td><strong>{number(item.familiar_profile_count)} / {number(item.whitespace_trial_profile_count)} / {number(item.graduated_profile_count)}</strong><small>F / Trial / G</small></td>
                <td><strong>{shortDate(item.first_sale_date)}</strong><small>{shortDate(item.last_sale_date)}</small></td>
                <td><strong>{decimal(item.total_stock)}</strong></td>
                <td><strong>{decimal(item.selected_cost)}</strong><small>{item.valuation_class || "—"} · {item.price_control || "—"}</small></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function FinanceWorkspace({
  data,
  items,
  selectedItem,
  setSelectedSkuId,
  actions,
}: {
  data: DashboardData;
  items: Product[];
  selectedItem: Product;
  setSelectedSkuId: (id: string) => void;
  actions: SuggestedAction[];
}) {
  const { summary } = data;
  return (
    <>
      <section className="kpi-grid finance-kpis">
        <KpiCard label="Net sales" value={money(summary.netSales)} detail={`${number(summary.netQuantity)} net quantity`} tone="positive" basis="REALISED ERP VALUE" />
        <KpiCard label="Gross sales" value={money(summary.grossSales)} detail={`${number(summary.invoices)} invoices`} basis="POSITIVE LINES" />
        <KpiCard label="Return leakage" value={money(summary.returnsValue)} detail={`${pct(summary.returnRatePct)} of gross sales`} tone="warning" basis="SIGNED RETURNS" />
        <KpiCard label="Invoice control" value={number(summary.invoiceLines)} detail={`${number(summary.invoices)} reconciled invoices`} basis="POSTGRESQL" />
        <KpiCard label="Valuation coverage" value={number(summary.valuationRows)} detail={`${number(summary.pricedProducts)} products with cost`} basis="SAP MBEW" />
        <KpiCard label="Gross margin" value="—" detail={`${number(summary.grossMarginProducts)} governed margin products · currencies missing`} basis="BLOCKED CONTROL" />
      </section>
      <section className="two-column finance-control-grid">
        <DepartmentActionPlan actions={actions} />
        <article className="card finance-ledger">
          <SectionHeader eyebrow="MONTHLY LEDGER" title="Gross sales, returns and net sales" subtitle="Exact invoice-period values from PostgreSQL." action={<BasisTag>Realised</BasisTag>} />
          <div className="ledger-table">
            <div className="ledger-head"><span>Month</span><span>Gross</span><span>Returns</span><span>Net</span></div>
            {data.monthlySales.map((month) => (
              <div key={month.month}><strong>{shortDate(month.month)}</strong><span>{money(month.gross_sales)}</span><span className="negative-value">{money(month.returns_value)}</span><b>{money(month.net_sales)}</b></div>
            ))}
          </div>
          <div className="finance-pipeline-note"><span>Planned recommendation value</span><strong>{money(summary.recommendedValue)}</strong><small>{number(summary.recommendations)} issued carts · not realised revenue</small></div>
        </article>
      </section>
      <DepartmentSkuSelector item={selectedItem} items={items} setSelectedSkuId={setSelectedSkuId} />
      <section className="two-column">
        <article className="card finance-review">
          <SectionHeader eyebrow="SKU FINANCIAL REVIEW" title="Revenue, return and stock controls" action={<BasisTag>Read only</BasisTag>} />
          <div className="availability-list">
            <div><p><strong>Net sales</strong><small>{number(selectedItem.invoice_count)} invoices · {number(selectedItem.sales_line_count)} lines</small></p><b>{money(selectedItem.net_sales_value)}</b></div>
            <div><p><strong>Gross sales</strong><small>{number(selectedItem.gross_quantity)} gross quantity</small></p><b>{money(selectedItem.gross_sales_value)}</b></div>
            <div><p><strong>Returns</strong><small>{number(selectedItem.return_quantity)} returned · {pct(selectedItem.return_rate_pct)}</small></p><b>{money(selectedItem.returns_value)}</b></div>
            <div><p><strong>Observed unit value</strong><small>Six-month weighted invoice history, not list price</small></p><b>{money(selectedItem.observed_unit_price)}</b></div>
            <div><p><strong>Sales trend</strong><small>First {shortDate(selectedItem.first_sale_date)} · last {shortDate(selectedItem.last_sale_date)}</small></p><b>{pct(selectedItem.sales_trend_pct)}</b></div>
          </div>
        </article>
        <article className="card finance-review">
          <SectionHeader eyebrow="VALUATION CONTROL" title="Cost and stock context" action={<BasisTag tone="missing">Currency unavailable</BasisTag>} />
          <div className="availability-list">
            <div><p><strong>Selected cost</strong><small>Do not compare with invoice value yet</small></p><b>{decimal(selectedItem.selected_cost)}</b></div>
            <div><p><strong>Total stock</strong><small>Across loaded valuation areas</small></p><b>{decimal(selectedItem.total_stock)}</b></div>
            <div><p><strong>Valuation areas</strong><small>Current product rollup</small></p><b>{number(selectedItem.valuation_area_count)}</b></div>
            <div><p><strong>Valuation class</strong><small>Product accounting control</small></p><b>{selectedItem.valuation_class || "—"}</b></div>
            <div><p><strong>Price control</strong><small>S standard · V moving average</small></p><b>{selectedItem.price_control || "—"}</b></div>
            <div><p><strong>Gross profit / margin</strong><small>Compatible price and cost currency required</small></p><b>—</b></div>
          </div>
        </article>
      </section>
      <section className="card table-card">
        <SectionHeader eyebrow="REGIONAL FINANCE CONTROL" title="Revenue and return exceptions" subtitle="Regional figures reconcile to the same live invoice source." action={<BasisTag>PostgreSQL</BasisTag>} />
        <div className="table-scroll">
          <table>
            <caption>Finance regional control table</caption>
            <thead><tr><th>Region</th><th>Invoices / lines</th><th>Gross sales</th><th>Returns</th><th>Net sales</th><th>Net quantity</th><th>Return rate</th></tr></thead>
            <tbody>{data.regionalSummary.map((item) => (
              <tr key={item.region_label}>
                <td><strong>{regionName(item.region_label)}</strong></td>
                <td><strong>{number(item.invoices)}</strong><small>{number(item.invoice_lines)} lines</small></td>
                <td><strong>{money(item.gross_sales)}</strong></td>
                <td><strong>{money(item.returns_value)}</strong></td>
                <td><strong>{money(item.net_sales)}</strong></td>
                <td><strong>{number(item.net_quantity)}</strong></td>
                <td><strong>{pct(item.return_rate_pct)}</strong></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      <section className="card table-card">
        <SectionHeader eyebrow="SKU EXCEPTION LEDGER" title="Revenue, returns and valuation context" subtitle="No GP, margin or discount leakage is inferred." action={<BasisTag tone="missing">Margin blank</BasisTag>} />
        <div className="table-scroll">
          <table>
            <caption>Finance SKU exception table</caption>
            <thead><tr><th>SKU</th><th>Net / gross sales</th><th>Invoices / lines</th><th>Net / gross qty</th><th>Returns</th><th>Trend</th><th>Observed unit value</th><th>Stock</th><th>Cost control</th></tr></thead>
            <tbody>{sortBy(items, (item) => item.net_sales_value).slice(0, 60).map((item) => (
              <tr key={item.product_id}>
                <td><strong>{item.product_name || "Description unavailable"}</strong><small>{item.product_id} · {item.category || "Category blank"}</small></td>
                <td><strong>{money(item.net_sales_value)}</strong><small>{money(item.gross_sales_value)} gross</small></td>
                <td><strong>{number(item.invoice_count)}</strong><small>{number(item.sales_line_count)} lines</small></td>
                <td><strong>{number(item.net_quantity)}</strong><small>{number(item.gross_quantity)} gross</small></td>
                <td><strong>{money(item.returns_value)}</strong><small>{pct(item.return_rate_pct)} · {number(item.return_quantity)} qty</small></td>
                <td><strong>{pct(item.sales_trend_pct)}</strong><small>{shortDate(item.last_sale_date)} last sale</small></td>
                <td><strong>{money(item.observed_unit_price)}</strong></td>
                <td><strong>{decimal(item.total_stock)}</strong></td>
                <td><strong>{decimal(item.selected_cost)}</strong><small>{item.valuation_class || "—"} · {item.price_control || "—"}</small></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function DepartmentWorkspace({
  role,
  data,
  items,
  selectedItem,
  setSelectedSkuId,
  openSku,
  region,
}: {
  role: RoleWorkspace;
  data: DashboardData;
  items: Product[];
  selectedItem: Product | null;
  setSelectedSkuId: (id: string) => void;
  openSku: (id: string) => void;
  region: string;
}) {
  const actions = buildSuggestedActions(role, data, items, selectedItem);
  if (!selectedItem) {
    return <section className="load-state"><strong>No SKU matches the current filters.</strong><span>Adjust the region, valuation area or SKU search.</span></section>;
  }
  return (
    <div className="department-workspace">
      <DepartmentSourceStrip role={role} data={data} />
      {role === "sales-head" && (
        <SalesHeadWorkspace data={data} items={items} openSku={openSku} actions={actions} />
      )}
      {role === "sales-agent" && (
        <SalesAgentWorkspace
          data={data}
          items={items}
          selectedItem={selectedItem}
          setSelectedSkuId={setSelectedSkuId}
          openSku={openSku}
          actions={actions}
          region={region}
        />
      )}
      {role === "rnd" && (
        <RndWorkspace
          data={data}
          items={items}
          selectedItem={selectedItem}
          setSelectedSkuId={setSelectedSkuId}
          actions={actions}
        />
      )}
      {role === "finance" && (
        <FinanceWorkspace
          data={data}
          items={items}
          selectedItem={selectedItem}
          setSelectedSkuId={setSelectedSkuId}
          actions={actions}
        />
      )}
    </div>
  );
}

function HealthView({ data }: { data: DashboardData }) {
  const { summary, readiness } = data;
  return (
    <>
      <section className="health-hero live-health">
        <div className="health-state">
          <span className="health-icon health-ok" aria-hidden="true">✓</span>
          <div><p className="eyebrow">ENVIRONMENT STATE</p><h2>Live PostgreSQL connected through n8n</h2><p>Sales, returns, geography, valuation, product-mix profiles and issued recommendations are live. Unsupported fields remain blank.</p></div>
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
        <KpiCard label="Product-mix profiles" value={number(summary.activeProfiles)} detail={`${number(summary.learningStates)} learning states · ${summary.activeModelVersion ?? "No active model"}`} tone={readiness.profiles ? "positive" : "warning"} basis="MODEL ENGINE" />
        <KpiCard label="Geography coverage" value={pct(summary.geoCoveragePct)} detail={`${number(summary.geocodedSalesCustomers)} geocoded sales customers`} tone={summary.geoCoveragePct === 100 ? "positive" : "warning"} basis="PARTIAL" />
        <KpiCard label="Recommendation feedback" value={number(summary.feedbackRecords)} detail="Exact outcomes stay blank until linked rows arrive" tone="warning" basis="EMPTY TABLE" />
        <KpiCard label="Valuation rows" value={number(summary.valuationRows)} detail={`${number(summary.pricedProducts)} products with valuation cost`} tone="positive" basis="SAP MBEW" />
      </section>

      <section className="health-columns">
        <article className="card">
          <SectionHeader eyebrow="RELEASE GATE" title="Production readiness" subtitle="Current state of the original application data contract." action={<span className="gate-pill">LIVE · GAPS VISIBLE</span>} />
          <div className="checklist">
            {[
              ["Live PostgreSQL schema", "Ready", "Operational tables and dashboard query were validated."],
              ["Sales & return invoices", "Ready", `${number(summary.invoiceLines)} lines reconcile to the supplied file.`],
              ["SAP valuation", "Ready", `${number(summary.valuationRows)} MBEW rows are loaded.`],
              ["Product-mix engine", "Ready", `${number(summary.activeProfiles)} active customer profiles and ${number(summary.recommendations)} issued cart are stored.`],
              ["Customer geography", "Pending", `${pct(summary.geoCoveragePct)} of sales customers currently have coordinates.`],
              ["Recommendation outcomes", "Blocked", "No exact cart / recommendation / invoice links are stored."],
              ["GP and order UOM", "Blocked", "Cost currency and governed sales UOM are not supplied, so GP and UOM stay blank."],
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
            <div><BasisTag>Exact now</BasisTag><p><strong>Product-mix profiles</strong><small>Familiar, whitespace trial and issued cart lines</small></p><b>Available</b></div>
            <div><BasisTag tone="proxy">Proxy</BasisTag><p><strong>Selling price</strong><small>Six-month weighted invoice average; not current list price</small></p><b>Directional</b></div>
            <div><BasisTag tone="missing">Blank</BasisTag><p><strong>Gross margin</strong><small>Cost currency is absent, so invoice price and valuation cost are not compared</small></p><b>Unavailable</b></div>
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
              <tr><td><span className="severity severity-high">High</span></td><td><strong>GP basis unavailable</strong><small>MBEW cost currency and invoice currency are not supplied</small></td><td>{number(summary.grossMarginProducts)}</td><td>Margin & GP ranking</td><td>Load governed currency-compatible price and cost</td><td>{readiness.grossMargin ? "Resolved" : "Open"}</td></tr>
              <tr><td><span className="severity severity-medium">Medium</span></td><td><strong>Customer coordinates incomplete</strong><small>Sales customers without geography</small></td><td>{number(summary.salesCustomers - summary.geocodedSalesCustomers)}</td><td>Map completeness</td><td>Load the remaining customer locations</td><td>Open</td></tr>
              <tr><td><span className="severity severity-medium">Medium</span></td><td><strong>Product attributes incomplete</strong><small>{number(summary.categorizedProducts)} products categorized; {number(summary.salesUnitProducts)} have governed sales UOM</small></td><td>{number(summary.activeProducts - summary.categorizedProducts)}</td><td>Category & order sizing</td><td>Load authoritative category, UOM and lifecycle fields</td><td>Open</td></tr>
              <tr><td><span className="severity severity-low">Low</span></td><td><strong>Unassigned sales territory</strong><small>Source contains “Not assigned” rows</small></td><td>1 territory</td><td>Regional attribution</td><td>Resolve source territory assignment</td><td>Open</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="connection-roadmap">
        <SectionHeader eyebrow="DATA READINESS" title="Connections needed for the complete platform" subtitle="The application is live now; these sources progressively populate its remaining blank fields." />
        <div>
          {[
            ["01", "Sales, returns, valuation & model", "PostgreSQL invoices, SAP MBEW, active profiles and issued carts", "Live"],
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
