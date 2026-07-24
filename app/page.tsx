"use client";

import { useMemo, useState } from "react";

type View =
  | "portfolio"
  | "sku"
  | "whitespace"
  | "regional"
  | "health";

type RegionMetric = {
  exposure: number;
  evaluated: number;
  accepted: number;
  pending: number;
  rejected: number;
  buyers: number;
  outlets: number;
  sales: number;
  opportunity: number;
  // Demo snapshot stores evaluated WHITESPACE_TRIAL lines here. Pending trial
  // exposure is estimated separately and never enters the capture denominator.
  whitespaceOffered: number;
  whitespaceCaptured: number;
  repeatRate: number;
  trend: number;
};

type Sku = {
  id: string;
  name: string;
  category: string;
  uom: string;
  unitValue: number;
  active: boolean;
  lineMix: Record<"FAMILIAR" | "WHITESPACE_TRIAL" | "GRADUATED", number>;
  regions: Record<string, RegionMetric>;
  dataHold?: boolean;
};

type ComputedSku = Sku &
  RegionMetric & {
    acceptanceRate: number;
    coverage: number;
    penetration: number;
    captureRate: number;
    recommendedValue: number;
    matchedValue: number;
    attainment: number;
    success: SuccessStatus;
  };

type SuccessStatus =
  | "Proven"
  | "Promising"
  | "Needs intervention"
  | "Underexposed opportunity"
  | "Insufficient evidence"
  | "Data quality hold";

type PortfolioTotals = {
  exposure: number;
  evaluated: number;
  accepted: number;
  pending: number;
  rejected: number;
  sales: number;
  recommendedValue: number;
  matchedValue: number;
  whitespaceOffered: number;
  whitespaceCaptured: number;
  buyers: number;
  opportunity: number;
};

const REGION_NAMES = ["Western", "Central", "Southern", "Northern"];

const SKUS: Sku[] = [
  {
    id: "EL-1042",
    name: "Nova LED Bulb 12W",
    category: "Lighting",
    uom: "EA",
    unitValue: 860,
    active: true,
    lineMix: { FAMILIAR: 52, WHITESPACE_TRIAL: 34, GRADUATED: 14 },
    regions: {
      Western: { exposure: 182, evaluated: 151, accepted: 112, pending: 24, rejected: 39, buyers: 68, outlets: 188, sales: 4380000, opportunity: 74, whitespaceOffered: 48, whitespaceCaptured: 31, repeatRate: 46, trend: 12.8 },
      Central: { exposure: 94, evaluated: 72, accepted: 48, pending: 17, rejected: 24, buyers: 32, outlets: 112, sales: 1720000, opportunity: 51, whitespaceOffered: 29, whitespaceCaptured: 16, repeatRate: 39, trend: 8.6 },
      Southern: { exposure: 76, evaluated: 61, accepted: 37, pending: 11, rejected: 24, buyers: 28, outlets: 97, sales: 1290000, opportunity: 62, whitespaceOffered: 31, whitespaceCaptured: 15, repeatRate: 34, trend: 3.4 },
      Northern: { exposure: 43, evaluated: 29, accepted: 14, pending: 10, rejected: 15, buyers: 12, outlets: 69, sales: 540000, opportunity: 58, whitespaceOffered: 18, whitespaceCaptured: 6, repeatRate: 25, trend: -4.2 },
    },
  },
  {
    id: "EL-2108",
    name: "VoltGuard 4-Way Extension",
    category: "Power",
    uom: "EA",
    unitValue: 3850,
    active: true,
    lineMix: { FAMILIAR: 68, WHITESPACE_TRIAL: 19, GRADUATED: 13 },
    regions: {
      Western: { exposure: 146, evaluated: 126, accepted: 92, pending: 14, rejected: 34, buyers: 53, outlets: 188, sales: 6920000, opportunity: 45, whitespaceOffered: 26, whitespaceCaptured: 17, repeatRate: 51, trend: 16.3 },
      Central: { exposure: 79, evaluated: 63, accepted: 42, pending: 12, rejected: 21, buyers: 27, outlets: 112, sales: 2680000, opportunity: 42, whitespaceOffered: 15, whitespaceCaptured: 9, repeatRate: 43, trend: 6.1 },
      Southern: { exposure: 61, evaluated: 47, accepted: 30, pending: 10, rejected: 17, buyers: 24, outlets: 97, sales: 2310000, opportunity: 37, whitespaceOffered: 14, whitespaceCaptured: 7, repeatRate: 38, trend: 4.8 },
      Northern: { exposure: 35, evaluated: 23, accepted: 9, pending: 9, rejected: 14, buyers: 8, outlets: 69, sales: 710000, opportunity: 46, whitespaceOffered: 10, whitespaceCaptured: 3, repeatRate: 18, trend: -8.7 },
    },
  },
  {
    id: "WR-3316",
    name: "FlexCore Cable 1.5 mm²",
    category: "Wiring",
    uom: "COIL",
    unitValue: 21800,
    active: true,
    lineMix: { FAMILIAR: 76, WHITESPACE_TRIAL: 14, GRADUATED: 10 },
    regions: {
      Western: { exposure: 128, evaluated: 116, accepted: 87, pending: 8, rejected: 29, buyers: 61, outlets: 188, sales: 12680000, opportunity: 36, whitespaceOffered: 18, whitespaceCaptured: 12, repeatRate: 58, trend: 9.9 },
      Central: { exposure: 71, evaluated: 60, accepted: 43, pending: 8, rejected: 17, buyers: 31, outlets: 112, sales: 4820000, opportunity: 29, whitespaceOffered: 9, whitespaceCaptured: 6, repeatRate: 47, trend: 5.2 },
      Southern: { exposure: 67, evaluated: 56, accepted: 42, pending: 7, rejected: 14, buyers: 33, outlets: 97, sales: 5360000, opportunity: 26, whitespaceOffered: 10, whitespaceCaptured: 7, repeatRate: 49, trend: 11.4 },
      Northern: { exposure: 38, evaluated: 30, accepted: 18, pending: 6, rejected: 12, buyers: 15, outlets: 69, sales: 1980000, opportunity: 34, whitespaceOffered: 8, whitespaceCaptured: 3, repeatRate: 33, trend: 1.8 },
    },
  },
  {
    id: "SW-4411",
    name: "Astra Modular Switch 2G",
    category: "Switchgear",
    uom: "EA",
    unitValue: 1420,
    active: true,
    lineMix: { FAMILIAR: 44, WHITESPACE_TRIAL: 39, GRADUATED: 17 },
    regions: {
      Western: { exposure: 164, evaluated: 121, accepted: 70, pending: 34, rejected: 51, buyers: 44, outlets: 188, sales: 3240000, opportunity: 89, whitespaceOffered: 61, whitespaceCaptured: 29, repeatRate: 31, trend: 2.7 },
      Central: { exposure: 88, evaluated: 63, accepted: 31, pending: 19, rejected: 32, buyers: 22, outlets: 112, sales: 1180000, opportunity: 68, whitespaceOffered: 38, whitespaceCaptured: 14, repeatRate: 23, trend: -2.2 },
      Southern: { exposure: 73, evaluated: 49, accepted: 22, pending: 18, rejected: 27, buyers: 17, outlets: 97, sales: 910000, opportunity: 71, whitespaceOffered: 35, whitespaceCaptured: 10, repeatRate: 19, trend: -7.1 },
      Northern: { exposure: 49, evaluated: 31, accepted: 10, pending: 13, rejected: 21, buyers: 9, outlets: 69, sales: 390000, opportunity: 63, whitespaceOffered: 24, whitespaceCaptured: 4, repeatRate: 12, trend: -11.5 },
    },
  },
  {
    id: "PR-5520",
    name: "ArcSafe MCB 32A",
    category: "Protection",
    uom: "EA",
    unitValue: 2960,
    active: true,
    lineMix: { FAMILIAR: 61, WHITESPACE_TRIAL: 24, GRADUATED: 15 },
    regions: {
      Western: { exposure: 111, evaluated: 91, accepted: 63, pending: 15, rejected: 28, buyers: 42, outlets: 188, sales: 4570000, opportunity: 53, whitespaceOffered: 28, whitespaceCaptured: 17, repeatRate: 44, trend: 14.2 },
      Central: { exposure: 54, evaluated: 41, accepted: 26, pending: 9, rejected: 15, buyers: 19, outlets: 112, sales: 1660000, opportunity: 47, whitespaceOffered: 15, whitespaceCaptured: 8, repeatRate: 37, trend: 7.8 },
      Southern: { exposure: 48, evaluated: 37, accepted: 23, pending: 8, rejected: 14, buyers: 18, outlets: 97, sales: 1420000, opportunity: 43, whitespaceOffered: 13, whitespaceCaptured: 7, repeatRate: 35, trend: 5.3 },
      Northern: { exposure: 29, evaluated: 19, accepted: 7, pending: 7, rejected: 12, buyers: 6, outlets: 69, sales: 430000, opportunity: 39, whitespaceOffered: 7, whitespaceCaptured: 2, repeatRate: 14, trend: -6.4 },
    },
  },
  {
    id: "LT-6814",
    name: "Halo Panel Light 18W",
    category: "Lighting",
    uom: "EA",
    unitValue: 4890,
    active: true,
    lineMix: { FAMILIAR: 29, WHITESPACE_TRIAL: 55, GRADUATED: 16 },
    regions: {
      Western: { exposure: 74, evaluated: 51, accepted: 32, pending: 18, rejected: 19, buyers: 24, outlets: 188, sales: 2180000, opportunity: 117, whitespaceOffered: 45, whitespaceCaptured: 23, repeatRate: 29, trend: 19.6 },
      Central: { exposure: 39, evaluated: 25, accepted: 13, pending: 10, rejected: 12, buyers: 11, outlets: 112, sales: 820000, opportunity: 83, whitespaceOffered: 24, whitespaceCaptured: 10, repeatRate: 18, trend: 12.1 },
      Southern: { exposure: 32, evaluated: 19, accepted: 9, pending: 9, rejected: 10, buyers: 8, outlets: 97, sales: 610000, opportunity: 79, whitespaceOffered: 20, whitespaceCaptured: 7, repeatRate: 14, trend: 8.2 },
      Northern: { exposure: 21, evaluated: 11, accepted: 3, pending: 7, rejected: 8, buyers: 3, outlets: 69, sales: 170000, opportunity: 66, whitespaceOffered: 12, whitespaceCaptured: 2, repeatRate: 0, trend: 3.9 },
    },
  },
  {
    id: "TL-7722",
    name: "ProLine Insulation Tape",
    category: "Accessories",
    uom: "ROLL",
    unitValue: 490,
    active: true,
    lineMix: { FAMILIAR: 72, WHITESPACE_TRIAL: 17, GRADUATED: 11 },
    regions: {
      Western: { exposure: 98, evaluated: 83, accepted: 64, pending: 11, rejected: 19, buyers: 48, outlets: 188, sales: 1120000, opportunity: 38, whitespaceOffered: 16, whitespaceCaptured: 12, repeatRate: 54, trend: 6.4 },
      Central: { exposure: 49, evaluated: 41, accepted: 29, pending: 6, rejected: 12, buyers: 23, outlets: 112, sales: 470000, opportunity: 27, whitespaceOffered: 8, whitespaceCaptured: 5, repeatRate: 45, trend: 2.3 },
      Southern: { exposure: 46, evaluated: 39, accepted: 29, pending: 5, rejected: 10, buyers: 22, outlets: 97, sales: 430000, opportunity: 25, whitespaceOffered: 7, whitespaceCaptured: 5, repeatRate: 41, trend: 5.7 },
      Northern: { exposure: 27, evaluated: 20, accepted: 11, pending: 5, rejected: 9, buyers: 9, outlets: 69, sales: 160000, opportunity: 31, whitespaceOffered: 6, whitespaceCaptured: 2, repeatRate: 25, trend: -1.7 },
    },
  },
  {
    id: "FN-8890",
    name: "RapidFix Wall Plug Kit",
    category: "Accessories",
    uom: "PACK",
    unitValue: 1180,
    active: false,
    dataHold: true,
    lineMix: { FAMILIAR: 19, WHITESPACE_TRIAL: 67, GRADUATED: 14 },
    regions: {
      Western: { exposure: 42, evaluated: 19, accepted: 8, pending: 17, rejected: 11, buyers: 7, outlets: 188, sales: 330000, opportunity: 96, whitespaceOffered: 30, whitespaceCaptured: 7, repeatRate: 9, trend: -16.8 },
      Central: { exposure: 22, evaluated: 9, accepted: 3, pending: 9, rejected: 6, buyers: 3, outlets: 112, sales: 110000, opportunity: 58, whitespaceOffered: 15, whitespaceCaptured: 3, repeatRate: 0, trend: -21.3 },
      Southern: { exposure: 18, evaluated: 7, accepted: 2, pending: 8, rejected: 5, buyers: 2, outlets: 97, sales: 76000, opportunity: 52, whitespaceOffered: 13, whitespaceCaptured: 2, repeatRate: 0, trend: -18.2 },
      Northern: { exposure: 11, evaluated: 3, accepted: 0, pending: 6, rejected: 3, buyers: 0, outlets: 69, sales: 0, opportunity: 44, whitespaceOffered: 8, whitespaceCaptured: 0, repeatRate: 0, trend: -100 },
    },
  },
];

const NAV_ITEMS: { id: View; label: string; icon: string; helper: string }[] = [
  { id: "portfolio", label: "Portfolio", icon: "▦", helper: "SKU performance" },
  { id: "sku", label: "SKU 360", icon: "◎", helper: "Evidence & outcomes" },
  { id: "whitespace", label: "Whitespace", icon: "◫", helper: "Opportunity & capture" },
  { id: "regional", label: "Regional", icon: "⌁", helper: "Sell-in performance" },
  { id: "health", label: "Data health", icon: "◇", helper: "Coverage & quality" },
];

const money = (value: number) =>
  new Intl.NumberFormat("en-LK", {
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
    style: "currency",
    currency: "LKR",
  }).format(value);

const number = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

const pct = (value: number) =>
  Number.isFinite(value) ? `${value.toFixed(1)}%` : "N/A";

function aggregateRegions(
  sku: Sku,
  region: string,
): RegionMetric {
  const keys = region === "All regions" ? REGION_NAMES : [region];
  const raw = keys.reduce<RegionMetric>(
    (sum, key) => {
      const item = sku.regions[key];
      return {
        exposure: sum.exposure + item.exposure,
        evaluated: sum.evaluated + item.evaluated,
        accepted: sum.accepted + item.accepted,
        pending: sum.pending + item.pending,
        rejected: sum.rejected + item.rejected,
        buyers: sum.buyers + item.buyers,
        outlets: sum.outlets + item.outlets,
        sales: sum.sales + item.sales,
        opportunity: sum.opportunity + item.opportunity,
        whitespaceOffered: sum.whitespaceOffered + item.whitespaceOffered,
        whitespaceCaptured: sum.whitespaceCaptured + item.whitespaceCaptured,
        repeatRate: sum.repeatRate + item.repeatRate,
        trend: sum.trend + item.trend,
      };
    },
    {
      exposure: 0,
      evaluated: 0,
      accepted: 0,
      pending: 0,
      rejected: 0,
      buyers: 0,
      outlets: 0,
      sales: 0,
      opportunity: 0,
      whitespaceOffered: 0,
      whitespaceCaptured: 0,
      repeatRate: 0,
      trend: 0,
    },
  );
  const count = keys.length;
  return {
    exposure: raw.exposure,
    evaluated: raw.evaluated,
    accepted: raw.accepted,
    pending: raw.pending,
    rejected: raw.rejected,
    buyers: raw.buyers,
    outlets: raw.outlets,
    sales: raw.sales,
    opportunity: raw.opportunity,
    whitespaceOffered: raw.whitespaceOffered,
    whitespaceCaptured: raw.whitespaceCaptured,
    repeatRate: raw.repeatRate / count,
    trend: raw.trend / count,
  };
}

function classify(item: Omit<ComputedSku, "success">, minimum: number): SuccessStatus {
  if (item.dataHold) return "Data quality hold";
  if (item.evaluated < minimum) {
    if (item.opportunity >= 90) return "Underexposed opportunity";
    return "Insufficient evidence";
  }
  if (item.acceptanceRate >= 68 && item.repeatRate >= 40) return "Proven";
  if (item.acceptanceRate >= 58) return "Promising";
  if (item.opportunity >= 130 && item.evaluated < minimum * 2.5)
    return "Underexposed opportunity";
  return "Needs intervention";
}

function StatusPill({ status }: { status: SuccessStatus }) {
  return <span className={`status-pill status-${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>;
}

function BasisTag({
  children,
  tone = "exact",
}: {
  children: React.ReactNode;
  tone?: "exact" | "proxy" | "missing";
}) {
  return <span className={`basis-tag basis-${tone}`}>{children}</span>;
}

function MiniBars({ values, accent = "blue" }: { values: number[]; accent?: "blue" | "mint" | "amber" }) {
  const max = Math.max(...values, 1);
  return (
    <div className={`mini-bars bars-${accent}`} aria-label="Trend spark bars">
      {values.map((value, index) => (
        <span key={`${value}-${index}`} style={{ height: `${Math.max((value / max) * 100, 8)}%` }} />
      ))}
    </div>
  );
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
      <div className="kpi-detail">
        <span>{detail}</span>
        {basis && <small>{basis}</small>}
      </div>
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
  action?: React.ReactNode;
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

function EmptyState() {
  return (
    <div className="empty-state">
      <span aria-hidden="true">⌕</span>
      <h3>No SKUs match these filters</h3>
      <p>Try lowering minimum exposure or broadening the region and category filters.</p>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("portfolio");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dateRange = "90-day demo snapshot";
  const [region, setRegion] = useState("All regions");
  const [category, setCategory] = useState("All categories");
  const [minimumExposure, setMinimumExposure] = useState(20);
  const [search, setSearch] = useState("");
  const [selectedSkuId, setSelectedSkuId] = useState("EL-1042");
  const [metricMode, setMetricMode] = useState<"count" | "value">("count");
  const [showFilters, setShowFilters] = useState(false);

  const computed = useMemo(() => {
    return SKUS.map((sku) => {
      const regionValues = aggregateRegions(sku, region);
      const acceptanceRate = regionValues.evaluated
        ? (regionValues.accepted / regionValues.evaluated) * 100
        : Number.NaN;
      const coverage = regionValues.exposure
        ? (regionValues.evaluated / regionValues.exposure) * 100
        : Number.NaN;
      const penetration = regionValues.outlets
        ? (regionValues.buyers / regionValues.outlets) * 100
        : Number.NaN;
      const captureRate = regionValues.whitespaceOffered
        ? (regionValues.whitespaceCaptured / regionValues.whitespaceOffered) * 100
        : Number.NaN;
      const recommendedValue = regionValues.exposure * sku.unitValue * 8.4;
      const matchedValue = recommendedValue * (acceptanceRate / 100) * (0.82 + Math.max(regionValues.trend, -20) / 200);
      const base = {
        ...sku,
        ...regionValues,
        acceptanceRate,
        coverage,
        penetration,
        captureRate,
        recommendedValue,
        matchedValue,
        attainment: recommendedValue ? (matchedValue / recommendedValue) * 100 : 0,
      };
      return { ...base, success: classify(base as Omit<ComputedSku, "success">, minimumExposure) };
    }).filter((sku) => {
      const matchesCategory = category === "All categories" || sku.category === category;
      const normalized = search.toLowerCase().trim();
      const matchesSearch = !normalized || `${sku.id} ${sku.name}`.toLowerCase().includes(normalized);
      return matchesCategory && matchesSearch && sku.evaluated >= minimumExposure;
    });
  }, [category, minimumExposure, region, search]);

  const selectedSku = computed.find((item) => item.id === selectedSkuId) ?? computed[0] ?? null;

  const totals = useMemo(
    () =>
      computed.reduce(
        (sum, item) => ({
          exposure: sum.exposure + item.exposure,
          evaluated: sum.evaluated + item.evaluated,
          accepted: sum.accepted + item.accepted,
          pending: sum.pending + item.pending,
          rejected: sum.rejected + item.rejected,
          sales: sum.sales + item.sales,
          recommendedValue: sum.recommendedValue + item.recommendedValue,
          matchedValue: sum.matchedValue + item.matchedValue,
          whitespaceOffered: sum.whitespaceOffered + item.whitespaceOffered,
          whitespaceCaptured: sum.whitespaceCaptured + item.whitespaceCaptured,
          buyers: sum.buyers + item.buyers,
          opportunity: sum.opportunity + item.opportunity,
        }),
        {
          exposure: 0,
          evaluated: 0,
          accepted: 0,
          pending: 0,
          rejected: 0,
          sales: 0,
          recommendedValue: 0,
          matchedValue: 0,
          whitespaceOffered: 0,
          whitespaceCaptured: 0,
          buyers: 0,
          opportunity: 0,
        },
      ),
    [computed],
  );

  const activeFilters = [
    dateRange,
    region,
    category !== "All categories" ? category : null,
    minimumExposure !== 20 ? `≥ ${minimumExposure} evaluated exposures` : null,
    search ? `SKU: ${search}` : null,
  ].filter(Boolean) as string[];

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
    setRegion("All regions");
    setCategory("All categories");
    setMinimumExposure(20);
    setSearch("");
  };

  const pageMeta = {
    portfolio: ["Portfolio overview", "See which SKUs are converting, stalling, or waiting for enough evidence."],
    sku: ["SKU 360", "Trace recommendation exposure through exact invoice outcome and repeat sell-in."],
    whitespace: ["Whitespace & penetration", "Separate stored-model opportunity from observed buyer penetration."],
    regional: ["Regional performance", "Compare acceptance, opportunity, and processed invoice sell-in by area."],
    health: ["Model & data health", "Know what is complete, stale, proxied, or still required for production."],
  }[view];

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
          <div><span className="connection-dot demo-dot" /><strong>Demo workspace</strong></div>
          <p>PostgreSQL not connected</p>
          <small>Last demo refresh<br />24 Jul 2026 · 09:42 SLST</small>
        </div>
        <div className="sidebar-user">
          <span>DK</span>
          <div><strong>Commercial analyst</strong><small>All demo regions</small></div>
          <button aria-label="Open account menu">•••</button>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}

      <main>
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation" aria-expanded={sidebarOpen}>☰</button>
          <div className="breadcrumb"><span>SKU Visibility</span><b>/</b><strong>{pageMeta[0]}</strong></div>
          <div className="topbar-actions">
            <span className="demo-chip">DEMO DATA</span>
            <button className="ghost-button" onClick={() => setView("health")}><span aria-hidden="true">↻</span> Data status</button>
            <button className="icon-button" aria-label="Notifications"><span aria-hidden="true">○</span><i /></button>
          </div>
        </header>

        <section className="demo-notice" role="note">
          <span aria-hidden="true">i</span>
          <p><strong>Transparent demo:</strong> Figures are realistic sample data, not live PostgreSQL results. Acceptance is modeled as an exact linked outcome; penetration is a partial-feedback proxy.</p>
          <button onClick={() => setView("health")}>Review data readiness →</button>
        </section>

        <section className="page-heading">
          <div>
            <p className="eyebrow">COMMERCIAL INTELLIGENCE · MODEL PMX-2026.06</p>
            <h1>{pageMeta[0]}</h1>
            <p>{pageMeta[1]}</p>
          </div>
          <div className="heading-actions">
            <div className="freshness"><span className="connection-dot demo-dot" /><span><strong>Demo snapshot</strong><small>Refreshed 09:42 SLST</small></span></div>
            <button className="secondary-button" disabled title="Exports unlock when the live analytics mart is connected" aria-label="Export unavailable in demo mode">Export unavailable</button>
          </div>
        </section>

        <section className={`filter-panel ${showFilters ? "filter-open" : ""}`} aria-label="Global dashboard filters">
          <div className="filter-panel-head">
            <div><strong>Demo snapshot filters</strong><small>Region, category, SKU, and evaluated-sample filters recalculate the sample; date basis and line type unlock with the fact mart.</small></div>
            <button className="mobile-filter-toggle" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
              {showFilters ? "Hide filters" : "Show filters"} <span>{activeFilters.length}</span>
            </button>
            <button className="reset-button" onClick={resetFilters}>Reset</button>
          </div>
          <div className="filters">
            <label>
              <span>Date range</span>
              <select value={dateRange} disabled aria-label="Date range is fixed for the demo snapshot">
                <option>{dateRange}</option>
              </select>
            </label>
            <label>
              <span>Date basis</span>
              <select value="Locked until fact connection" disabled aria-label="Date basis requires the live fact mart">
                <option>Locked until fact connection</option>
              </select>
            </label>
            <label>
              <span>Region</span>
              <select value={region} onChange={(event) => setRegion(event.target.value)}>
                <option>All regions</option>
                {REGION_NAMES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option>All categories</option>
                {[...new Set(SKUS.map((sku) => sku.category))].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Line type</span>
              <select value="All types · snapshot" disabled aria-label="Line type filtering requires the live fact mart">
                <option>All types · snapshot</option>
              </select>
            </label>
            <label>
              <span>Minimum evaluated exposure</span>
              <select value={minimumExposure} onChange={(event) => setMinimumExposure(Number(event.target.value))}>
                <option value={5}>5+</option>
                <option value={20}>20+</option>
                <option value={50}>50+</option>
                <option value={100}>100+</option>
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
            <small>{number(totals.evaluated)} evaluated lines in scope</small>
          </div>
        </section>

        <div className="page-content">
          {computed.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {view === "portfolio" && (
                <PortfolioView
                  items={computed}
                  totals={totals}
                  metricMode={metricMode}
                  setMetricMode={setMetricMode}
                  openSku={openSku}
                  region={region}
                />
              )}
              {view === "sku" && selectedSku && (
                <SkuView
                  item={selectedSku}
                  allItems={computed}
                  setSelectedSkuId={setSelectedSkuId}
                  region={region}
                  dateRange={dateRange}
                />
              )}
              {view === "whitespace" && (
                <WhitespaceView items={computed} totals={totals} openSku={openSku} region={region} />
              )}
              {view === "regional" && (
                <RegionalView
                  items={computed}
                  selectedRegion={region}
                  openSku={openSku}
                />
              )}
              {view === "health" && <HealthView totals={totals} />}
            </>
          )}
        </div>
        <footer>
          <span>SKU Pulse · Product Mix Visibility</span>
          <span>Demo environment · PostgreSQL analytic views pending validation</span>
          <button onClick={() => setView("health")}>Metric definitions</button>
        </footer>
      </main>
    </div>
  );
}

function PortfolioView({
  items,
  totals,
  metricMode,
  setMetricMode,
  openSku,
  region,
}: {
  items: ComputedSku[];
  totals: PortfolioTotals;
  metricMode: "count" | "value";
  setMetricMode: (mode: "count" | "value") => void;
  openSku: (id: string) => void;
  region: string;
}) {
  const coverage = totals.exposure ? (totals.evaluated / totals.exposure) * 100 : Number.NaN;
  const acceptance = totals.evaluated ? (totals.accepted / totals.evaluated) * 100 : Number.NaN;
  const capture = totals.whitespaceOffered ? (totals.whitespaceCaptured / totals.whitespaceOffered) * 100 : Number.NaN;
  const attainment = totals.recommendedValue ? (totals.matchedValue / totals.recommendedValue) * 100 : Number.NaN;
  const repeat = Math.round(totals.accepted * 0.42);
  return (
    <>
      <div className="basis-strip">
        <div><BasisTag>Exact linked recommendation outcome</BasisTag><span>Acceptance · evaluated lines only</span></div>
        <div><BasisTag tone="proxy">Post-launch observed proxy</BasisTag><span>Buyer penetration · processed invoices</span></div>
        <div><BasisTag tone="missing">Additional data required</BasisTag><span>True local-market penetration & sell-through</span></div>
      </div>
      <section className="kpi-grid">
        <KpiCard label="Recommended SKUs" value={number(items.length)} detail={`${number(totals.exposure)} deduplicated line exposures`} basis="ISSUED LINES" />
        <KpiCard label="Evaluation coverage" value={pct(coverage)} detail={`${number(totals.evaluated)} evaluated · ${number(totals.pending)} pending`} tone={coverage >= 75 ? "positive" : "warning"} basis="EXACT LINK" />
        <KpiCard label="Line acceptance" value={pct(acceptance)} detail={`${number(totals.accepted)} of ${number(totals.evaluated)} evaluated`} tone={acceptance >= 60 ? "positive" : "warning"} basis="EXACT LINK" />
        <KpiCard label="Matched value scenario" value={money(totals.matchedValue)} detail={`${pct(attainment)} illustrative attainment; replace with outcome fact`} tone="positive" basis="DEMO ESTIMATE" />
        <KpiCard label="Whitespace capture" value={pct(capture)} detail={`${number(totals.whitespaceCaptured)} of ${number(totals.whitespaceOffered)} evaluated trials`} basis="PENDING EXCLUDED" />
        <KpiCard label="Processed invoice sales" value={money(totals.sales)} detail={`${number(totals.buyers)} observed buyer-SKU records`} basis="SELL-IN · PARTIAL FEED" />
      </section>

      <section className="two-column">
        <article className="card">
          <SectionHeader
            eyebrow="RECOMMENDATION JOURNEY"
            title="From exposure to repeat sell-in"
            subtitle="Pending lines stay outside the acceptance denominator."
            action={
              <div className="segmented" aria-label="Funnel metric mode">
                <button className={metricMode === "count" ? "active" : ""} onClick={() => setMetricMode("count")} aria-pressed={metricMode === "count"}>Line count</button>
                <button className={metricMode === "value" ? "active" : ""} onClick={() => setMetricMode("value")} aria-pressed={metricMode === "value"}>Value</button>
              </div>
            }
          />
          <div className="funnel">
            {[
              ["Recommended", metricMode === "count" ? totals.exposure : totals.recommendedValue, 100, "All issued, eligible lines"],
              ["Evaluated", metricMode === "count" ? totals.evaluated : totals.recommendedValue * coverage / 100, coverage, `${pct(coverage)} coverage`],
              ["Invoice accepted", metricMode === "count" ? totals.accepted : totals.matchedValue, metricMode === "count" ? acceptance : attainment, `${pct(acceptance)} of evaluated`],
              ["Repeat purchase", metricMode === "count" ? repeat : totals.matchedValue * 0.42, (repeat / Math.max(totals.exposure, 1)) * 100, "Illustrative demo cohort · live repeat mart required"],
            ].map(([label, value, width, note], index) => (
              <div className="funnel-row" key={String(label)}>
                <span className="funnel-index">{index + 1}</span>
                <div>
                  <div className="funnel-meta"><strong>{label}</strong><b>{metricMode === "count" ? number(Number(value)) : money(Number(value))}</b></div>
                  <div className="funnel-track"><i style={{ width: `${Math.max(Number(width), 5)}%` }} /></div>
                  <small>{note}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="funnel-foot">
            <span><i className="legend pending" /> {number(totals.pending)} pending</span>
            <span><i className="legend rejected" /> {number(totals.rejected)} evaluated, not accepted</span>
          </div>
        </article>

        <article className="card">
          <SectionHeader
            eyebrow="PORTFOLIO POSITION"
            title="Penetration × acceptance"
            subtitle="Bubble size represents processed invoice sell-in."
            action={<BasisTag tone="proxy">Mixed basis</BasisTag>}
          />
          <div className="scatter">
            <span className="quadrant-label q1">Scale winners</span>
            <span className="quadrant-label q2">Convert demand</span>
            <span className="quadrant-label q3">Build evidence</span>
            <span className="quadrant-label q4">Niche performers</span>
            <span className="axis-label axis-y">Acceptance rate →</span>
            <span className="axis-label axis-x">Observed buyer penetration →</span>
            {items.map((item) => {
              const size = Math.max(15, Math.min(32, 13 + item.sales / 800000));
              return (
                <button
                  key={item.id}
                  className={`scatter-dot ${item.trend < 0 ? "dot-down" : item.success === "Proven" ? "dot-proven" : ""}`}
                  style={{
                    left: `${Math.min(Math.max(item.penetration * 2.25, 5), 90)}%`,
                    bottom: `${Math.min(Math.max(item.acceptanceRate * 0.98, 7), 89)}%`,
                    width: size,
                    height: size,
                  }}
                  title={`${item.id}: ${pct(item.acceptanceRate)} acceptance, ${pct(item.penetration)} observed penetration`}
                  onClick={() => openSku(item.id)}
                  aria-label={`Open ${item.name}`}
                ><span>{item.id.split("-")[0]}</span></button>
              );
            })}
          </div>
          <div className="chart-legend">
            <span><i className="legend dot-blue" /> Positive / stable</span>
            <span><i className="legend dot-green" /> Proven</span>
            <span><i className="legend dot-red" /> Declining</span>
            <small><BasisTag tone="proxy">Penetration proxy</BasisTag></small>
          </div>
        </article>
      </section>

      <section className="card table-card">
        <SectionHeader
          eyebrow="SKU SCOREBOARD"
          title="Performance by product"
          subtitle={`Ranked within ${region.toLowerCase()} · Proven ≥68% acceptance and ≥40% repeat; Promising ≥58%; sample gate uses the selected evaluated-exposure threshold.`}
          action={<button className="text-button" disabled title="Column configuration is not persisted in demo mode">Demo columns</button>}
        />
        <div className="table-scroll">
          <table>
            <caption>SKU recommendation and processed sales performance</caption>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Success classification</th>
                <th>Exposure</th>
                <th>Coverage</th>
                <th>Acceptance</th>
                <th>Target attainment</th>
                <th>Whitespace</th>
                <th>Observed penetration</th>
                <th>Processed sell-in</th>
                <th>90d trend</th>
                <th aria-label="Open SKU" />
              </tr>
            </thead>
            <tbody>
              {[...items].sort((a, b) => b.acceptanceRate - a.acceptanceRate).map((item) => (
                <tr key={item.id}>
                  <td>
                    <button className="sku-cell" onClick={() => openSku(item.id)}>
                      <span>{item.id.slice(0, 2)}</span>
                      <b>{item.name}<small>{item.id} · {item.category}</small></b>
                    </button>
                  </td>
                  <td><StatusPill status={item.success} /><small className="sample-note">n={number(item.evaluated)} evaluated</small></td>
                  <td><strong>{number(item.exposure)}</strong><small>{number(item.pending)} pending</small></td>
                  <td><div className="cell-meter"><i style={{ width: `${item.coverage}%` }} /></div><small>{pct(item.coverage)}</small></td>
                  <td><strong className={item.acceptanceRate >= 60 ? "positive-text" : item.acceptanceRate < 45 ? "negative-text" : ""}>{pct(item.acceptanceRate)}</strong><small>{number(item.accepted)} accepted</small></td>
                  <td><strong>{pct(item.attainment)}</strong><small>matched value</small></td>
                  <td><strong>{pct(item.captureRate)}</strong><small>{number(item.opportunity)} eligible</small></td>
                  <td><strong>{pct(item.penetration)}</strong><small>processed feed</small></td>
                  <td><strong>{money(item.sales)}</strong><MiniBars values={[31, 36, 33, 44, 48, 53 + item.trend]} accent={item.trend < 0 ? "amber" : "blue"} /></td>
                  <td><span className={item.trend >= 0 ? "trend-up" : "trend-down"}>{item.trend >= 0 ? "↗" : "↘"} {pct(Math.abs(item.trend))}</span></td>
                  <td><button className="row-arrow" onClick={() => openSku(item.id)} aria-label={`Open ${item.name}`}>→</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          <span>Showing {items.length} SKUs · region, category, search, and evaluated-sample filters applied; locked controls await the fact mart</span>
          <span><BasisTag>Acceptance exact</BasisTag> <BasisTag tone="proxy">Penetration proxy</BasisTag></span>
        </div>
      </section>

      <RegionMatrix items={items} region={region} openSku={openSku} />
    </>
  );
}

function RegionMatrix({
  items,
  region,
  openSku,
}: {
  items: ComputedSku[];
  region: string;
  openSku: (id: string) => void;
}) {
  const top = items.slice(0, 6);
  const visibleRegions =
    region === "All regions" ? REGION_NAMES : [region];
  return (
    <section className="card table-card matrix-card">
      <SectionHeader
        eyebrow="REGION × SKU"
        title="Acceptance heatmap"
        subtitle="Exact evaluated recommendation outcomes. Click a cell to inspect its SKU."
        action={<BasisTag>Exact linked outcome</BasisTag>}
      />
      <div className="table-scroll">
        <table className="heatmap">
          <caption>Acceptance rate by SKU and region</caption>
          <thead><tr><th>Region</th>{top.map((item) => <th key={item.id}>{item.id}</th>)}<th>Region signal</th></tr></thead>
          <tbody>
            {visibleRegions.map((regionName) => (
              <tr key={regionName}>
                <th>{regionName}<small>{number(top.reduce((sum, sku) => sum + sku.regions[regionName].evaluated, 0))} eval.</small></th>
                {top.map((item) => {
                  const m = item.regions[regionName];
                  const rate = m.evaluated ? (m.accepted / m.evaluated) * 100 : 0;
                  return (
                    <td key={item.id}>
                      <button
                        onClick={() => openSku(item.id)}
                        className={`heat-cell heat-${rate >= 68 ? "high" : rate >= 50 ? "mid" : "low"}`}
                        title={`${item.name}, ${regionName}: ${pct(rate)}, n=${m.evaluated}`}
                      >{Math.round(rate)}<small>%</small></button>
                    </td>
                  );
                })}
                <td><MiniBars values={regionName === "Western" ? [43, 48, 54, 61, 65, 72] : regionName === "Northern" ? [43, 41, 39, 36, 34, 31] : [38, 42, 46, 49, 52, 55]} accent={regionName === "Northern" ? "amber" : "mint"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SkuView({
  item,
  allItems,
  setSelectedSkuId,
  region,
  dateRange,
}: {
  item: ComputedSku;
  allItems: ComputedSku[];
  setSelectedSkuId: (id: string) => void;
  region: string;
  dateRange: string;
}) {
  const acceptedSeries = [34, 39, 43, 47, 52, 59, 62, Math.round(item.acceptanceRate)];
  const salesSeries = [42, 47, 44, 53, 58, 64, 69, 72 + item.trend];
  const maxSales = Math.max(...salesSeries);
  return (
    <>
      <section className="sku-hero card">
        <div className="sku-identity">
          <span className="product-tile">{item.id.slice(0, 2)}</span>
          <div>
            <div className="sku-title-row">
              <h2>{item.name}</h2>
              <span className={item.active ? "active-product" : "inactive-product"}>{item.active ? "Active" : "Inactive"}</span>
            </div>
            <p>{item.id} · {item.category} · UOM {item.uom}</p>
            <div className="identity-meta">
              <span>Historical unit value <strong>{money(item.unitValue)}</strong></span>
              <span>Category source <strong>Heuristic</strong></span>
              <span>Model <strong>PMX-2026.06</strong></span>
            </div>
          </div>
        </div>
        <div className="sku-selector">
          <label htmlFor="sku-select">Selected SKU</label>
          <select id="sku-select" value={item.id} onChange={(event) => setSelectedSkuId(event.target.value)}>
            {allItems.map((sku) => <option value={sku.id} key={sku.id}>{sku.id} · {sku.name}</option>)}
          </select>
          <StatusPill status={item.success} />
        </div>
      </section>

      <div className="basis-strip">
        <div><BasisTag>Acceptance: exact</BasisTag><span>SKU appears with positive value on exact linked invoice</span></div>
        <div><BasisTag tone="proxy">Penetration: proxy</BasisTag><span>{number(item.buyers)} observed buyers / {number(item.outlets)} active modeled outlets</span></div>
        <div><BasisTag tone="missing">True sell-through unavailable</BasisTag><span>Inventory and downstream POS not connected</span></div>
      </div>

      <section className="kpi-grid sku-kpis">
        <KpiCard label="Evaluated exposure" value={number(item.evaluated)} detail={`${pct(item.coverage)} of ${number(item.exposure)} issued`} basis="EXACT LINK" />
        <KpiCard label="Acceptance rate" value={pct(item.acceptanceRate)} detail={`${number(item.accepted)} accepted · ${number(item.rejected)} not accepted`} tone={item.acceptanceRate >= 60 ? "positive" : "warning"} basis="EVALUATED ONLY" />
        <KpiCard label="Value attainment scenario" value={pct(item.attainment)} detail={`${money(item.matchedValue)} illustrative matched value`} tone="positive" basis="DEMO ESTIMATE" />
        <KpiCard label="Whitespace capture" value={pct(item.captureRate)} detail={`${number(item.whitespaceCaptured)} of ${number(item.whitespaceOffered)} evaluated trials`} basis="PENDING EXCLUDED" />
        <KpiCard label="Repeat purchase" value={pct(item.repeatRate)} detail="Accepted buyers with sufficient follow-up" basis="PROCESSED FEED" />
        <KpiCard label="Processed sell-in" value={money(item.sales)} detail={`${item.trend >= 0 ? "+" : ""}${pct(item.trend)} vs previous period`} tone={item.trend >= 0 ? "positive" : "warning"} basis="PARTIAL FEED" />
      </section>

      <section className="two-column sku-charts">
        <article className="card">
          <SectionHeader
            eyebrow="TRAJECTORY"
            title="Recommendation conversion"
            subtitle={`${dateRange} · ${region.toLowerCase()} · evaluated lines only`}
            action={<BasisTag tone="proxy">Demo trend shape</BasisTag>}
          />
          <div className="column-chart" aria-label="Acceptance trend chart">
            {acceptedSeries.map((value, index) => (
              <div key={index}><span>{index % 2 === 1 ? `${value}%` : ""}</span><i style={{ height: `${value}%` }} /><small>W{index + 1}</small></div>
            ))}
          </div>
          <div className="chart-summary">
            <span><i className="legend dot-blue" /> Acceptance rate</span>
            <strong>{pct(item.acceptanceRate)} <small>{item.trend >= 0 ? "improving" : "declining"}</small></strong>
          </div>
        </article>
        <article className="card">
          <SectionHeader
            eyebrow="PROCESSED INVOICES"
            title="Sell-in value trend"
            subtitle="Feedback invoices only; not authoritative ERP total."
            action={<BasisTag tone="proxy">Partial feed</BasisTag>}
          />
          <div className="area-bars" aria-label="Processed invoice sell-in trend">
            {salesSeries.map((value, index) => (
              <div key={index} style={{ height: `${Math.max((value / maxSales) * 100, 8)}%` }}>
                <i />
                <span>{index === salesSeries.length - 1 ? money(item.sales / 8) : ""}</span>
              </div>
            ))}
          </div>
          <div className="chart-summary">
            <span><i className="legend dot-green" /> Matched SKU value</span>
            <span><i className="legend dot-blue" /> Total processed sell-in</span>
            <strong className={item.trend >= 0 ? "trend-up" : "trend-down"}>{item.trend >= 0 ? "↗" : "↘"} {pct(Math.abs(item.trend))}</strong>
          </div>
        </article>
      </section>

      <section className="three-column">
        <article className="card">
          <SectionHeader eyebrow="ORIGINAL LINE TYPE" title="Recommendation mix" subtitle="Classification preserved at issue time." />
          <div className="donut-layout">
            <div
              className="donut"
              style={{ background: `conic-gradient(#3b82f6 0 ${item.lineMix.FAMILIAR}%, #20b486 ${item.lineMix.FAMILIAR}% ${item.lineMix.FAMILIAR + item.lineMix.WHITESPACE_TRIAL}%, #f59e0b ${item.lineMix.FAMILIAR + item.lineMix.WHITESPACE_TRIAL}% 100%)` }}
            ><span><strong>100%</strong><small>{number(item.exposure)} lines</small></span></div>
            <ul className="donut-legend">
              <li><i className="legend dot-blue" /><span>Familiar<small>Replenishment</small></span><strong>{item.lineMix.FAMILIAR}%</strong></li>
              <li><i className="legend dot-green" /><span>Whitespace trial<small>New category test</small></span><strong>{item.lineMix.WHITESPACE_TRIAL}%</strong></li>
              <li><i className="legend dot-amber" /><span>Graduated<small>Previously captured</small></span><strong>{item.lineMix.GRADUATED}%</strong></li>
            </ul>
          </div>
        </article>
        <article className="card">
          <SectionHeader eyebrow="REGIONAL SIGNAL" title="Where this SKU works" subtitle="Acceptance exact · penetration proxy." />
          <div className="rank-list">
            {REGION_NAMES.filter(
              (regionName) =>
                region === "All regions" || regionName === region,
            ).map((regionName) => {
              const m = item.regions[regionName];
              const rate = m.evaluated ? (m.accepted / m.evaluated) * 100 : 0;
              return { regionName, rate, m };
            }).sort((a, b) => b.rate - a.rate).map(({ regionName, rate, m }, index) => (
              <div className="rank-row" key={regionName}>
                <span className="rank-number">{index + 1}</span>
                <div><strong>{regionName}</strong><small>n={m.evaluated} · {m.buyers}/{m.outlets} buyers</small></div>
                <div className="rank-meter"><i style={{ width: `${rate}%` }} /></div>
                <b>{pct(rate)}</b>
              </div>
            ))}
          </div>
        </article>
        <article className="card">
          <SectionHeader eyebrow="NON-ACCEPTANCE" title="Recorded reasons" subtitle="Action data is optional and incomplete." action={<BasisTag tone="proxy">62% coverage</BasisTag>} />
          <div className="reason-list">
            {[
              ["Price above expectation", 34],
              ["Existing stock on hand", 27],
              ["Customer declined trial", 19],
              ["UOM / pack-size mismatch", 12],
              ["Other / no reason", 8],
            ].map(([label, value]) => (
              <div key={String(label)}><span><strong>{label}</strong><b>{value}%</b></span><i><em style={{ width: `${value}%` }} /></i></div>
            ))}
          </div>
        </article>
      </section>

      <EvidenceTable item={item} region={region} />

      <section className="provenance-card">
        <div><span aria-hidden="true">⌘</span><p><strong>Model provenance</strong><small>PMX-2026.06 · source window 01 Jan–30 Jun 2026 · customer snapshot join is interim</small></p></div>
        <div><span>Pricing</span><strong>Historical model fallback</strong></div>
        <div><span>Category</span><strong>Heuristic derivation</strong></div>
        <div><span>Confidence</span><strong>{item.evaluated >= 50 ? "Sufficient sample" : "Directional only"} · n={item.evaluated}</strong></div>
      </section>
    </>
  );
}

function EvidenceTable({
  item,
  region,
}: {
  item: ComputedSku;
  region: string;
}) {
  const evidence = [
    { cart: "CRT-20641", rec: "REC-8F14", customer: "City Electricals", region: "Western", type: "FAMILIAR", target: 6880, actual: 7740, result: "Accepted", latency: "2d" },
    { cart: "CRT-20628", rec: "REC-8E93", customer: "Ruwan Traders", region: "Central", type: "WHITESPACE_TRIAL", target: 4300, actual: 3440, result: "Captured", latency: "4d" },
    { cart: "CRT-20597", rec: "REC-8DA7", customer: "Southern Power Mart", region: "Southern", type: "GRADUATED", target: 5160, actual: 0, result: "Not accepted", latency: "7d" },
    { cart: "CRT-20581", rec: "REC-8D20", customer: "Northline Agencies", region: "Northern", type: "WHITESPACE_TRIAL", target: 2580, actual: 0, result: "Pending", latency: "—" },
    { cart: "CRT-20572", rec: "REC-8CAB", customer: "Metro Hardware", region: "Western", type: "FAMILIAR", target: 8600, actual: 10320, result: "Accepted", latency: "1d" },
  ];
  return (
    <section className="card table-card">
      <SectionHeader
        eyebrow="AUDIT TRAIL"
        title="Recommendation evidence"
        subtitle={`Masked sample rows shaped like the exact cart + recommendation + customer contract for ${item.id}.`}
        action={<BasisTag tone="proxy">Demo contract rows</BasisTag>}
      />
      <div className="table-scroll">
        <table>
          <caption>Exact recommendation-to-invoice evidence</caption>
          <thead><tr><th>Cart / recommendation</th><th>SKU</th><th>Customer</th><th>Region</th><th>Line type</th><th>Target</th><th>Actual</th><th>Outcome</th><th>Latency</th></tr></thead>
          <tbody>{evidence
            .filter((row) => region === "All regions" || row.region === region)
            .map((row) => (
            <tr key={row.cart}>
              <td><strong>{row.cart}</strong><small>{row.rec}</small></td>
              <td><strong>{item.id}</strong><small>{item.name}</small></td>
              <td><strong>{row.customer}</strong><small>Masked demo outlet</small></td>
              <td>{row.region}</td>
              <td><span className={`line-pill line-${row.type.toLowerCase()}`}>{row.type.replaceAll("_", " ")}</span></td>
              <td>{money(row.target)}</td>
              <td><strong>{money(row.actual)}</strong><small>{row.actual ? `${Math.round(row.actual / row.target * 100)}% attainment` : "No positive value"}</small></td>
              <td><span className={`outcome outcome-${row.result.toLowerCase().replaceAll(" ", "-")}`}>{row.result}</span></td>
              <td>{row.latency}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="table-foot"><span>Pending is not rejection and is excluded from evaluated acceptance.</span><BasisTag tone="proxy">Demo evidence shape</BasisTag></div>
    </section>
  );
}

function WhitespaceView({
  items,
  totals,
  openSku,
  region,
}: {
  items: ComputedSku[];
  totals: PortfolioTotals;
  openSku: (id: string) => void;
  region: string;
}) {
  const pendingTrials = Math.round(
    items.reduce(
      (sum, item) =>
        sum + item.pending * (item.lineMix.WHITESPACE_TRIAL / 100),
      0,
    ),
  );
  const evaluatedTrials = totals.whitespaceOffered;
  const issuedTrials = evaluatedTrials + pendingTrials;
  const captured = totals.whitespaceCaptured;
  const uncaptured = Math.max(evaluatedTrials - captured, 0);
  return (
    <>
      <section className="metric-definition-banner">
        <div><span>1</span><p><strong>Eligible whitespace</strong><small>Stored seed for a customer with no category purchase in the model window.</small></p></div>
        <i />
        <div><span>2</span><p><strong>Exposed trial</strong><small>Actually issued as WHITESPACE_TRIAL.</small></p></div>
        <i />
        <div><span>3</span><p><strong>Captured</strong><small>Positive value on the exact linked invoice.</small></p></div>
        <i />
        <div><span>4</span><p><strong>Graduated</strong><small>Category was captured before this later recommendation.</small></p></div>
      </section>

      <section className="kpi-grid">
        <KpiCard label="Eligible seed customers" value={number(totals.opportunity)} detail="Stored-model opportunity, not exhaustive market whitespace" basis="STORED SEED PROXY" />
        <KpiCard label="Issued trial exposure" value={number(issuedTrials)} detail={`${number(evaluatedTrials)} evaluated · ${number(pendingTrials)} pending`} basis="PENDING SEPARATE" />
        <KpiCard label="Evaluated trials" value={number(evaluatedTrials)} detail="Only these lines enter the capture denominator" basis="GOVERNED DENOMINATOR" />
        <KpiCard label="Captured trials" value={number(captured)} detail={`${pct(evaluatedTrials ? captured / evaluatedTrials * 100 : Number.NaN)} exact capture rate`} tone="positive" basis="EXACT LINK" />
        <KpiCard label="Evaluated, not captured" value={number(uncaptured)} detail={`${number(pendingTrials)} pending trials excluded`} tone="warning" basis="NOT PENDING" />
        <KpiCard label="Addressable penetration" value="Unavailable" detail="Authoritative local outlet universe not connected" basis="ADDITIONAL DATA" />
      </section>

      <section className="two-column whitespace-lead">
        <article className="card">
          <SectionHeader eyebrow="OPPORTUNITY CONVERSION" title="Stored seed to captured trial" subtitle={`Current scope: ${region.toLowerCase()}`} action={<BasisTag tone="proxy">Mixed basis</BasisTag>} />
          <div className="stage-flow">
            {[
              ["Eligible", totals.opportunity, "Stored-model seed proxy"],
              ["Issued", issuedTrials, "Evaluated + pending trial lines"],
              ["Evaluated", evaluatedTrials, "Capture denominator"],
              ["Captured", captured, "Positive exact linked outcome"],
            ].map(([label, value, helper], index) => (
              <div key={String(label)} className="stage-node">
                <div><small>0{index + 1}</small><strong>{number(Number(value))}</strong><span>{label}</span></div>
                <p>{helper}</p>
              </div>
            ))}
          </div>
          <div className="callout">
            <span aria-hidden="true">!</span>
            <p><strong>Opportunity is directional.</strong> The current model retains selected seeds, not the complete historic customer–SKU fact.</p>
          </div>
        </article>
        <article className="card">
          <SectionHeader eyebrow="ACTION QUEUE" title="Highest whitespace headroom" subtitle="High stored eligibility with low evaluated trial exposure." />
          <div className="opportunity-list">
            {[...items].sort((a, b) => b.opportunity - a.opportunity).slice(0, 5).map((item, index) => (
              <button key={item.id} onClick={() => openSku(item.id)}>
                <span className="rank-number">{index + 1}</span>
                <span><strong>{item.name}</strong><small>{item.id} · {item.category}</small></span>
                <span><strong>{number(item.opportunity)}</strong><small>eligible</small></span>
                <span><strong>{number(item.whitespaceOffered)}</strong><small>evaluated trials</small></span>
                <span className={item.captureRate >= 50 ? "positive-text" : "warning-text"}><strong>{pct(item.captureRate)}</strong><small>capture</small></span>
                <b>→</b>
              </button>
            ))}
          </div>
        </article>
      </section>

      <WhitespaceMatrix items={items} openSku={openSku} region={region} />
      <CustomerOpportunityTable items={items} region={region} />

      <section className="unavailable-panel">
        <div><span aria-hidden="true">∅</span><p><strong>True local-market penetration is not yet measurable</strong><small>Requires the authoritative addressable outlet universe, stable region mapping, and complete customer–SKU baseline facts.</small></p></div>
        <button disabled title="See Data health for the required source list">Requires source integration</button>
      </section>
    </>
  );
}

function WhitespaceMatrix({
  items,
  openSku,
  region,
}: {
  items: ComputedSku[];
  openSku: (id: string) => void;
  region: string;
}) {
  const visibleRegions =
    region === "All regions" ? REGION_NAMES : [region];
  return (
    <section className="card table-card">
      <SectionHeader eyebrow="OPPORTUNITY MATRIX" title="Whitespace by SKU and region" subtitle="Cells show eligible stored-seed customers. Acceptance is shown alongside for contrast." action={<BasisTag tone="proxy">Stored seed proxy</BasisTag>} />
      <div className="table-scroll">
        <table className="whitespace-matrix">
          <caption>Stored whitespace opportunity by product and region</caption>
          <thead><tr><th>SKU</th>{visibleRegions.map((name) => <th key={name}>{name}</th>)}<th>Total eligible</th><th>Trial capture</th><th /></tr></thead>
          <tbody>{items.map((item) => (
            <tr key={item.id}>
              <td><strong>{item.name}</strong><small>{item.id} · {item.category}</small></td>
              {visibleRegions.map((name) => {
                const value = item.regions[name].opportunity;
                return <td key={name}><span className={`opportunity-cell opp-${value >= 80 ? "high" : value >= 45 ? "mid" : "low"}`}><strong>{value}</strong><small>{item.regions[name].whitespaceOffered} evaluated trials</small></span></td>;
              })}
              <td><strong>{number(item.opportunity)}</strong><small>{pct(item.outlets ? item.opportunity / item.outlets * 100 : 0)} eligibility</small></td>
              <td><strong>{pct(item.captureRate)}</strong><small>{item.whitespaceCaptured}/{item.whitespaceOffered} evaluated</small></td>
              <td><button className="row-arrow" onClick={() => openSku(item.id)} aria-label={`Open ${item.name}`}>→</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

function CustomerOpportunityTable({
  items,
  region: selectedRegion,
}: {
  items: ComputedSku[];
  region: string;
}) {
  const rows = [
    ["CUS-10492", "Cityline Traders", "Western", "C-04", items[0], 82, 77, "Not exposed", "Available", "A. Perera"],
    ["CUS-20814", "Mahaweli Electricals", "Central", "C-02", items[1] ?? items[0], 74, 69, "Trial pending", "Available", "S. Iqbal"],
    ["CUS-31887", "Sunrise Hardware", "Southern", "C-03", items[3] ?? items[0], 68, 64, "Uncaptured", "Cooldown", "T. Silva"],
    ["CUS-41202", "Jaffna Power Mart", "Northern", "C-01", items[5] ?? items[0], 63, 58, "Captured", "Available", "R. Kumar"],
    ["CUS-10651", "Metro Build Centre", "Western", "C-05", items[4] ?? items[0], 59, 54, "Not exposed", "Available", "M. Fernando"],
  ];
  return (
    <section className="card table-card">
      <SectionHeader eyebrow="CUSTOMER DRILLDOWN" title="Priority outlet opportunities" subtitle="Masked demo customers ranked by peer evidence and whitespace score." action={<button className="text-button" disabled title="Exports unlock when the live mart is connected">Demo queue</button>} />
      <div className="table-scroll">
        <table>
          <caption>Customer-level stored whitespace opportunities</caption>
          <thead><tr><th>Customer</th><th>Region / cluster</th><th>Seed SKU</th><th>Peer penetration</th><th>Score</th><th>Capture state</th><th>Cooldown</th><th>Sales agent</th></tr></thead>
          <tbody>{rows
            .filter((row) => selectedRegion === "All regions" || row[2] === selectedRegion)
            .map(([id, customer, region, cluster, sku, peer, score, state, cooldown, agent]) => {
            const typedSku = sku as ComputedSku;
            return <tr key={String(id)}>
              <td><strong>{customer as string}</strong><small>{id as string}</small></td>
              <td><strong>{region as string}</strong><small>{cluster as string}</small></td>
              <td><strong>{typedSku?.name}</strong><small>{typedSku?.id} · seed rank 1</small></td>
              <td><strong>{peer as number}%</strong><small>category peers</small></td>
              <td><strong>{score as number}</strong><small>non-currency score</small></td>
              <td><span className={`outcome outcome-${String(state).toLowerCase().replaceAll(" ", "-")}`}>{state as string}</span></td>
              <td><span className={cooldown === "Cooldown" ? "warning-text" : ""}>{cooldown as string}</span></td>
              <td>{agent as string}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>
  );
}

function RegionalView({
  items,
  selectedRegion,
  openSku,
}: {
  items: ComputedSku[];
  selectedRegion: string;
  openSku: (id: string) => void;
}) {
  const regional = REGION_NAMES.filter((name) => selectedRegion === "All regions" || name === selectedRegion).map((name) => {
    const metrics = items.map((sku) => aggregateRegions(sku, name));
    const sums = metrics.reduce(
      (sum, m) => ({
        exposure: sum.exposure + m.exposure,
        evaluated: sum.evaluated + m.evaluated,
        accepted: sum.accepted + m.accepted,
        pending: sum.pending + m.pending,
        buyers: sum.buyers + m.buyers,
        outlets: Math.max(sum.outlets, m.outlets),
        sales: sum.sales + m.sales,
        opportunity: sum.opportunity + m.opportunity,
        trend: sum.trend + m.trend,
      }),
      { exposure: 0, evaluated: 0, accepted: 0, pending: 0, buyers: 0, outlets: 0, sales: 0, opportunity: 0, trend: 0 },
    );
    return {
      name,
      ...sums,
      acceptance: sums.evaluated ? sums.accepted / sums.evaluated * 100 : 0,
      coverage: sums.exposure ? sums.evaluated / sums.exposure * 100 : 0,
      penetration: sums.outlets ? Math.min(sums.buyers / (sums.outlets * Math.max(items.length, 1)) * 100, 100) : 0,
      trend: metrics.length ? sums.trend / metrics.length : 0,
    };
  });
  const regionTotals = regional.reduce((sum, item) => ({ sales: sum.sales + item.sales, exposure: sum.exposure + item.exposure, evaluated: sum.evaluated + item.evaluated, accepted: sum.accepted + item.accepted, pending: sum.pending + item.pending, opportunity: sum.opportunity + item.opportunity }), { sales: 0, exposure: 0, evaluated: 0, accepted: 0, pending: 0, opportunity: 0 });
  return (
    <>
      <div className="basis-strip">
        <div><BasisTag>Acceptance: exact</BasisTag><span>Linked recommendation outcome by current demo region</span></div>
        <div><BasisTag tone="proxy">Sell-in: processed feedback</BasisTag><span>Not yet reconciled to authoritative ERP invoices</span></div>
        <div><BasisTag tone="missing">No geographic map</BasisTag><span>Governed area-to-geography mapping is not supplied</span></div>
      </div>
      <section className="kpi-grid">
        <KpiCard label="Regions in scope" value={number(regional.length)} detail={`${number(items.length)} visible SKUs`} basis="AREA LABEL" />
        <KpiCard label="Regional acceptance" value={pct(regionTotals.evaluated ? regionTotals.accepted / regionTotals.evaluated * 100 : 0)} detail={`${number(regionTotals.accepted)} accepted lines`} tone="positive" basis="EXACT LINK" />
        <KpiCard label="Evaluation coverage" value={pct(regionTotals.exposure ? regionTotals.evaluated / regionTotals.exposure * 100 : 0)} detail={`${number(regionTotals.pending)} pending lines`} basis="PENDING SEPARATE" />
        <KpiCard label="Processed sell-in" value={money(regionTotals.sales)} detail="Feedback invoices in current scope" basis="PARTIAL FEED" />
        <KpiCard label="Whitespace headroom" value={number(regionTotals.opportunity)} detail="Stored eligible seed records" basis="MODEL PROXY" />
        <KpiCard label="True sell-through" value="Unavailable" detail="Inventory receipts and downstream POS required" basis="ADDITIONAL DATA" />
      </section>

      <section className="regional-grid">
        {regional.map((item, index) => (
          <article className="region-card" key={item.name}>
            <div className="region-card-head"><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{item.name}</h3><small>{number(item.outlets)} active modeled outlets</small></div><b className={item.trend >= 0 ? "trend-up" : "trend-down"}>{item.trend >= 0 ? "↗" : "↘"} {pct(Math.abs(item.trend))}</b></div>
            <div className="region-primary"><strong>{pct(item.acceptance)}</strong><span>line acceptance<small>n={number(item.evaluated)} evaluated</small></span></div>
            <div className="region-card-metrics">
              <div><span>Coverage</span><strong>{pct(item.coverage)}</strong></div>
              <div><span>Observed penetration</span><strong>{pct(item.penetration)}</strong></div>
              <div><span>Processed sell-in</span><strong>{money(item.sales)}</strong></div>
              <div><span>Eligible whitespace</span><strong>{number(item.opportunity)}</strong></div>
            </div>
            <div className="region-bar"><i style={{ width: `${item.acceptance}%` }} /></div>
          </article>
        ))}
      </section>

      <section className="two-column regional-analysis">
        <article className="card">
          <SectionHeader eyebrow="REGIONAL COMPARISON" title="Acceptance and coverage" subtitle="A low coverage region should not be ranked as a rejection failure." action={<BasisTag>Exact</BasisTag>} />
          <div className="comparison-bars">
            {regional.map((item) => (
              <div key={item.name}>
                <span><strong>{item.name}</strong><small>n={item.evaluated}</small></span>
                <div><i style={{ width: `${item.acceptance}%` }} /><em style={{ width: `${item.coverage}%` }} /></div>
                <b>{pct(item.acceptance)}</b>
              </div>
            ))}
          </div>
          <div className="chart-legend"><span><i className="legend dot-blue" /> Acceptance</span><span><i className="legend dot-green" /> Evaluation coverage</span></div>
        </article>
        <article className="card">
          <SectionHeader eyebrow="SALES EXECUTION" title="Agent conversion signal" subtitle="Masked demo agents; line outcomes exclude pending." />
          <div className="agent-list">
            {[
              ["A. Perera", "Western", 72.4, 162, 18.3],
              ["T. Silva", "Southern", 66.8, 94, 10.6],
              ["S. Iqbal", "Central", 61.5, 107, 4.9],
              ["R. Kumar", "Northern", 39.7, 52, -8.8],
            ].filter((row) => selectedRegion === "All regions" || row[1] === selectedRegion).map(([agent, agentRegion, rate, sample, trend]) => (
              <div key={String(agent)}>
                <span className="avatar">{String(agent).split(" ").map((part) => part[0]).join("")}</span>
                <span><strong>{agent as string}</strong><small>{agentRegion as string} · n={sample as number}</small></span>
                <div className="rank-meter"><i style={{ width: `${rate}%` }} /></div>
                <b>{rate as number}%</b>
                <em className={Number(trend) >= 0 ? "trend-up" : "trend-down"}>{Number(trend) >= 0 ? "↗" : "↘"} {Math.abs(Number(trend))}%</em>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="card table-card">
        <SectionHeader eyebrow="REGION × SKU" title="Regional SKU scorecard" subtitle="Processed invoice sell-in and exact linked acceptance shown side-by-side." action={<button className="text-button" disabled title="Exports unlock when the live mart is connected">Demo scorecard</button>} />
        <div className="table-scroll">
          <table>
            <caption>SKU performance by current region filter</caption>
            <thead><tr><th>SKU</th><th>Acceptance</th><th>Evaluation coverage</th><th>Observed penetration</th><th>Whitespace headroom</th><th>Processed sell-in</th><th>Trend</th><th>Status</th><th /></tr></thead>
            <tbody>{items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.name}</strong><small>{item.id} · {item.category}</small></td>
                <td><strong>{pct(item.acceptanceRate)}</strong><small>n={number(item.evaluated)}</small></td>
                <td><strong>{pct(item.coverage)}</strong><small>{number(item.pending)} pending</small></td>
                <td><strong>{pct(item.penetration)}</strong><small>proxy basis</small></td>
                <td><strong>{number(item.opportunity)}</strong><small>stored seed eligible</small></td>
                <td><strong>{money(item.sales)}</strong><small>partial feed</small></td>
                <td><span className={item.trend >= 0 ? "trend-up" : "trend-down"}>{item.trend >= 0 ? "↗" : "↘"} {pct(Math.abs(item.trend))}</span></td>
                <td><StatusPill status={item.success} /></td>
                <td><button className="row-arrow" onClick={() => openSku(item.id)} aria-label={`Open ${item.name}`}>→</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function HealthView({ totals }: { totals: PortfolioTotals }) {
  const coverage = totals.exposure ? totals.evaluated / totals.exposure * 100 : 0;
  return (
    <>
      <section className="health-hero">
        <div className="health-state">
          <span className="health-icon" aria-hidden="true">!</span>
          <div><p className="eyebrow">ENVIRONMENT STATE</p><h2>Demo data · PostgreSQL connection not configured</h2><p>The interface is ready for curated analytic views, but this workspace has no live DDL, credentials, row counts, or execution history.</p></div>
        </div>
        <div className="health-meta">
          <div><span>Snapshot refreshed</span><strong>24 Jul 2026 · 09:42 SLST</strong></div>
          <div><span>Model reference</span><strong>PMX-2026.06 · demo</strong></div>
          <div><span>Workflow posture</span><strong>Staging definitions · inactive</strong></div>
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard label="Evaluated line coverage" value={pct(coverage)} detail={`${number(totals.pending)} issued lines still pending`} tone={coverage >= 80 ? "positive" : "warning"} basis="DEMO SNAPSHOT" />
        <KpiCard label="Unknown products" value="1" detail="Retained visibly; not dropped from metrics" tone="warning" basis="PRODUCT MASTER" />
        <KpiCard label="Unmapped regions" value="0" detail="Demo area labels all assigned" tone="positive" basis="CURRENT LABEL" />
        <KpiCard label="Expired unevaluated carts" value="14" detail="Must remain distinct from rejection" tone="warning" basis="STATUS GAP" />
        <KpiCard label="Invoice-feed coverage" value="Unknown" detail="ERP denominator is not integrated" basis="ADDITIONAL DATA" />
        <KpiCard label="Model age" value="24 days" detail="Monthly refresh target; logical run ID pending" basis="DEMO METADATA" />
      </section>

      <section className="health-columns">
        <article className="card">
          <SectionHeader eyebrow="RELEASE GATE" title="Production readiness" subtitle="Evidence required before commercial KPI sign-off." action={<span className="gate-pill">5 BLOCKERS</span>} />
          <div className="checklist">
            {[
              ["Live schema & masked sample", "Blocked", "Validate actual keys, status values, constraints, and timestamps."],
              ["Product & category master", "Blocked", "Replace heuristic category and historical-price fallback."],
              ["Invoice-feed completeness", "Blocked", "Reconcile processed feedback against authoritative ERP totals."],
              ["Region & user entitlements", "Blocked", "Add stable region IDs, SSO, and row-level authorization."],
              ["Metric reconciliation", "Pending", "Sign off 20 carts, 20 invoices, and 10 SKUs across two regions."],
              ["Dashboard metric definitions", "Ready", "Exact, proxy, pending, and unavailable bases are separated."],
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
          <SectionHeader eyebrow="DATA CONTRACT" title="Metric availability" subtitle="What can be claimed with the current PostgreSQL baseline." />
          <div className="availability-list">
            <div><BasisTag>Exact now</BasisTag><p><strong>Recommendation acceptance</strong><small>Cart + rec + customer + SKU linked outcome</small></p><b>Available</b></div>
            <div><BasisTag>Exact now</BasisTag><p><strong>Processed invoice sell-in</strong><small>Only within captured feedback invoices</small></p><b>Available</b></div>
            <div><BasisTag tone="proxy">Proxy</BasisTag><p><strong>Observed buyer penetration</strong><small>Processed buyers / active modeled outlets</small></p><b>Directional</b></div>
            <div><BasisTag tone="proxy">Proxy</BasisTag><p><strong>Modeled whitespace opportunity</strong><small>Stored selected seed records only</small></p><b>Directional</b></div>
            <div><BasisTag tone="missing">Missing</BasisTag><p><strong>Local-market penetration</strong><small>Needs authoritative outlet universe</small></p><b>Unavailable</b></div>
            <div><BasisTag tone="missing">Missing</BasisTag><p><strong>True sell-through</strong><small>Needs inventory and downstream POS</small></p><b>Unavailable</b></div>
          </div>
        </article>
      </section>

      <section className="card table-card">
        <SectionHeader eyebrow="QUALITY MONITOR" title="Open data-quality issues" subtitle="Warnings stay visible; records are not silently dropped or coerced." action={<button className="text-button" disabled title="Downloads unlock when the live health view is connected">Demo issue log</button>} />
        <div className="table-scroll">
          <table>
            <caption>Demo data quality issue register</caption>
            <thead><tr><th>Severity</th><th>Issue</th><th>Affected records</th><th>Metric impact</th><th>Recommended action</th><th>Owner</th></tr></thead>
            <tbody>
              <tr><td><span className="severity severity-high">High</span></td><td><strong>Missing target-order fallback</strong><small>Zero normalized as a valid target</small></td><td>41 carts</td><td>Target attainment</td><td>Correct engine fallback before KPI sign-off</td><td>Data engineering</td></tr>
              <tr><td><span className="severity severity-high">High</span></td><td><strong>Invoice-feed denominator absent</strong><small>Feedback coverage cannot be quantified</small></td><td>All periods</td><td>Sales & penetration</td><td>Integrate ERP control totals</td><td>Integration team</td></tr>
              <tr><td><span className="severity severity-medium">Medium</span></td><td><strong>Inactive / unknown product</strong><small>FN-8890 lacks governed master state</small></td><td>1 SKU</td><td>Category reporting</td><td>Reconcile product master</td><td>Product data</td></tr>
              <tr><td><span className="severity severity-medium">Medium</span></td><td><strong>Expired carts still ISSUED</strong><small>Pending duration exceeds cart expiry</small></td><td>14 carts</td><td>Evaluation coverage</td><td>Add explicit expiry process</td><td>Platform</td></tr>
              <tr><td><span className="severity severity-low">Low</span></td><td><strong>Cart actions incomplete</strong><small>Reason-code coverage below threshold</small></td><td>38% gaps</td><td>Rejection reasons</td><td>Enforce action telemetry</td><td>Sales operations</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="connection-roadmap">
        <SectionHeader eyebrow="DATA READINESS" title="Connections needed for the full platform" subtitle="The interface keeps unavailable metrics disabled until these sources pass reconciliation." />
        <div>
          {[
            ["01", "Curated PostgreSQL marts", "Recommendation lines, outcomes, invoices, current customer model", "First"],
            ["02", "Authoritative product master", "Category, UOM, effective price, lifecycle, margin", "Required"],
            ["03", "ERP coverage controls", "Invoice totals and feedback completeness by period", "Required"],
            ["04", "Outlet & region universe", "Stable IDs, hierarchy, eligibility, addressable outlets", "Penetration"],
            ["05", "Inventory / downstream POS", "Opening, receipts, transfers, returns, closing, outlet sales", "Sell-through"],
          ].map(([num, title, detail, tag]) => (
            <article key={num}><span>{num}</span><div><strong>{title}</strong><small>{detail}</small></div><b>{tag}</b></article>
          ))}
        </div>
      </section>
    </>
  );
}
