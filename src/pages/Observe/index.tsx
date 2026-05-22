import { type FC } from "react";
import { ArrowUpRight, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import {
  Panel,
  PanelHeader,
  SectionEyebrow,
  StatusDot,
  type DotTone,
} from "@/components/blueprint";

/* ─────────────────────────── types ─────────────────────────── */

interface Service {
  name: string;
  env: string;
  latency: string;
  rps: string;
  errors: string;
  status: DotTone;
}

interface Alert {
  sev: DotTone;
  title: string;
  ago: string;
  rule: string;
}

/* ─────────────────────────── data ──────────────────────────── */

const SERVICES: Service[] = [
  { name: "api-gateway",    env: "production", latency: "42ms",  rps: "8.2k", errors: "0.04%", status: "ok"   },
  { name: "auth-service",   env: "production", latency: "18ms",  rps: "2.1k", errors: "0.00%", status: "ok"   },
  { name: "billing",        env: "production", latency: "104ms", rps: "640",  errors: "0.41%", status: "warn" },
  { name: "search-indexer", env: "production", latency: "212ms", rps: "180",  errors: "0.01%", status: "ok"   },
  { name: "notifications",  env: "production", latency: "31ms",  rps: "1.4k", errors: "0.02%", status: "ok"   },
  { name: "worker-async",   env: "production", latency: "—",     rps: "—",    errors: "—",     status: "info" },
  { name: "ml-inference",   env: "production", latency: "318ms", rps: "94",   errors: "2.14%", status: "fail" },
  { name: "data-warehouse", env: "production", latency: "—",     rps: "—",    errors: "—",     status: "muted"},
];

const ALERTS: Alert[] = [
  { sev: "fail", title: "ml-inference · 5xx rate above 2%",  ago: "4m",  rule: "p95 errors > 1%" },
  { sev: "warn", title: "billing · latency p95 above 100ms", ago: "12m", rule: "p95 > 100ms · 5m" },
  { sev: "warn", title: "agent runner-29 marked unhealthy",  ago: "1h",  rule: "missed 3 heartbeats" },
  { sev: "info", title: "deploy api-gateway · v2.3.8",       ago: "12m", rule: "canary 25%" },
];

/* ─────────────────────── SloSummary ────────────────────────── */

function SloSummary() {
  return (
    <Panel className="p-5">
      <SectionEyebrow>service level · last 30d</SectionEyebrow>

      {/* Big reading */}
      <div className="reading mt-2 font-mono text-[36px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground">
        99.94<span className="text-[24px] text-fg-muted">%</span>
      </div>

      {/* Error budget */}
      <p className="mt-2 text-[12px] text-fg-muted">
        <span className="text-accent-success">14m</span> error budget remaining of 21m monthly
      </p>

      {/* Progress bar */}
      <div className="mt-3.5 h-1.5 overflow-hidden rounded-full border">
        <div
          className="h-full rounded-full opacity-70"
          style={{ width: "67%", background: "var(--accent-success)" }}
        />
      </div>

      {/* Meta grid */}
      <div
        className="mt-4 grid gap-3 border-t pt-3.5"
        style={{ gridTemplateColumns: "1fr 1fr" }}
      >
        <MetaItem label="MTTR"   value="9m"   />
        <MetaItem label="MTBF"   value="6.4d" />
        <MetaItem label="Burn"   value="0.4x" />
        <MetaItem label="Window" value="30d"  />
      </div>
    </Panel>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-subtle">
        {label}
      </span>
      <span className="font-mono text-[13px] text-foreground">{value}</span>
    </div>
  );
}

/* ───────────────────── LatencyChart ────────────────────────── */

const P95_POINTS = "0,90 20,85 40,80 60,82 80,75 100,72 120,65 140,68 160,60 180,55 200,58 220,50 240,45 260,52 280,40 300,38 320,30 340,32 360,28 380,25 400,32";
const P50_POINTS = "0,110 20,108 40,105 60,109 80,100 100,98 120,92 140,94 160,85 180,82 200,86 220,78 240,72 260,80 280,65 300,62 320,55 340,58 360,52 380,48 400,55";
const P50_AREA   = "M0 110 L20,108 L40,105 L60,109 L80,100 L100,98 L120,92 L140,94 L160,85 L180,82 L200,86 L220,78 L240,72 L260,80 L280,65 L300,62 L320,55 L340,58 L360,52 L380,48 L400,55 L400 140 L0 140 Z";

function LatencyChart() {
  return (
    <Panel className="p-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <SectionEyebrow>p50 / p95 latency · last 6h</SectionEyebrow>
        <div className="flex shrink-0 items-center gap-3 font-mono text-[11px] text-fg-subtle">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-px w-2"
              style={{ background: "var(--fg)" }}
            />
            p50 42ms
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-px w-2"
              style={{ background: "var(--brand-signal)" }}
            />
            p95 138ms
          </span>
        </div>
      </div>

      {/* SVG chart */}
      <svg
        viewBox="0 0 400 140"
        preserveAspectRatio="none"
        style={{ width: "100%", height: 140, marginTop: 12 }}
      >
        <defs>
          <linearGradient id="obs-grad-p50" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="var(--fg)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--fg)" stopOpacity="0"    />
          </linearGradient>
        </defs>

        {/* dashed gridlines */}
        {([28, 56, 84, 112] as const).map((y) => (
          <line
            key={y}
            x1="0" y1={y} x2="400" y2={y}
            stroke="var(--border)"
            strokeDasharray="2 4"
            strokeWidth="1"
          />
        ))}

        {/* p95 line */}
        <polyline
          fill="none"
          stroke="var(--brand-signal)"
          strokeOpacity="0.7"
          strokeWidth="1.6"
          points={P95_POINTS}
        />

        {/* p50 area fill */}
        <path fill="url(#obs-grad-p50)" d={P50_AREA} />

        {/* p50 line */}
        <polyline
          fill="none"
          stroke="var(--fg)"
          strokeWidth="1.4"
          points={P50_POINTS}
        />
      </svg>
    </Panel>
  );
}

/* ─────────────────────── ServicesTable ─────────────────────── */

function errorColor(svc: Service): string {
  if (svc.status === "fail") return "var(--accent-danger)";
  if (svc.status === "warn") return "var(--accent-warn)";
  return "var(--fg-muted)";
}

function ServicesTable() {
  return (
    <Panel>
      <PanelHeader title="Services" sub={`${SERVICES.length} monitored`} />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left">
              {(["Service", "Env", "Latency p95", "RPS", "Errors", "Status", ""] as const).map(
                (col, i) => (
                  <th
                    key={col || `action-${i}`}
                    className={
                      "px-5 py-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-subtle" +
                      (i === 6 ? " text-right" : "")
                    }
                  >
                    {col}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {SERVICES.map((svc) => (
              <tr key={svc.name} className="border-t border-border">
                <td className="px-5 py-3 font-medium">{svc.name}</td>
                <td className="px-5 py-3 text-fg-muted">{svc.env}</td>
                <td className="px-5 py-3 font-mono">{svc.latency}</td>
                <td className="px-5 py-3 font-mono">{svc.rps}</td>
                <td
                  className="px-5 py-3 font-mono"
                  style={{ color: errorColor(svc) }}
                >
                  {svc.errors}
                </td>
                <td className="px-5 py-3">
                  <StatusDot tone={svc.status} pulse={svc.status === "info"} />
                </td>
                <td className="px-5 py-3 text-right">
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    Open
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ──────────────────────── AlertsFeed ───────────────────────── */

function AlertsFeed() {
  return (
    <Panel>
      <PanelHeader title="Active alerts" sub={`${ALERTS.length} firing`} />
      <ul className="m-0 list-none p-0">
        {ALERTS.map((alert, i) => (
          <li
            key={i}
            className={
              "flex items-center gap-3.5 px-5 py-3.5" +
              (i > 0 ? " border-t border-border" : "")
            }
          >
            <StatusDot tone={alert.sev} pulse={alert.sev === "info"} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-foreground">
                {alert.title}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-fg-subtle">
                {alert.rule}
              </div>
            </div>
            <span className="shrink-0 font-mono text-[11px] text-fg-subtle">
              {alert.ago} ago
            </span>
            <Button variant="outline" size="sm">
              Ack
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ────────────────────────── Page ───────────────────────────── */

const Observe: FC = () => {
  return (
    <section className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader
        eyebrow="observe / runtime"
        title="Observe"
        sub="Runtime health, latency, throughput and error budget for every service."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Last 6h
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Top split: SLO summary + latency chart */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1.5fr" }}>
        <SloSummary />
        <LatencyChart />
      </div>

      {/* Services table */}
      <ServicesTable />

      {/* Active alerts feed */}
      <AlertsFeed />
    </section>
  );
};

export default Observe;
