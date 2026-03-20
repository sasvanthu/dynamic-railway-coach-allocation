import { useCallback, useEffect, useState } from "react";
import { Train, AlertTriangle, Activity, TrendingUp, Zap, RefreshCw, Clock } from "lucide-react";
import backend from "~backend/client";
import KPICard from "../components/KPICard";
import LoadingSpinner from "../components/LoadingSpinner";
import SeverityBadge from "../components/SeverityBadge";
import NetworkGraph from "../components/NetworkGraph";
import { useToast } from "@/components/ui/use-toast";

interface DashboardData {
  total_trains: number;
  active_disruptions: number;
  coaches_in_use: number;
  total_coaches: number;
  coaches_utilization_pct: number;
  forecast_accuracy_pct: number;
  deadhead_reduction_pct: number;
  live_routes_enabled: boolean;
  live_routes_synced: number;
  live_routes_total: number;
  live_routes_last_sync: string | null;
  live_status_enabled: boolean;
  live_status_on_time: number;
  live_status_delayed: number;
  live_status_cancelled: number;
  live_status_external_synced: number;
  live_status_last_sync: string | null;
  live_status_providers: string[];
  network_nodes: Array<{ id: number; code: string; name: string; zone: string; lat: number; lng: number; crowd_density: number }>;
  network_edges: Array<{ source: number; target: number; route_name: string; distance_km: number; demand_level: string }>;
}

interface LiveStatusRecord {
  train_id: number;
  train_number: string;
  train_name: string;
  status: string;
  delay_minutes: number | null;
  source: string;
  provider: string;
  current_station_code?: string | null;
  current_station_name?: string | null;
  message?: string | null;
  fetched_at: string;
}

interface Disruption {
  id: number;
  type: string;
  severity: string;
  detected_at: string;
  train_number: string | null;
  train_name: string | null;
  status: string;
}

const timeSlots = ["T+6h", "T+12h", "T+18h", "T+24h", "T+30h", "T+36h"];

interface ForecastRecord {
  train_id: number;
  train_number: string | null;
  demand_score: number;
  forecast_time: string;
}

interface HeatmapRow {
  id: number;
  label: string;
  scores: number[];
}

const SLOT_OFFSETS_HOURS = [6, 12, 18, 24, 30, 36];

function buildHeatmapData(forecasts: ForecastRecord[]): HeatmapRow[] {
  const now = Date.now();
  const trainMap = new Map<number, HeatmapRow>();

  for (const forecast of forecasts) {
    const trainId = forecast.train_id;
    if (!trainMap.has(trainId)) {
      trainMap.set(trainId, {
        id: trainId,
        label: forecast.train_number ?? `Train ${trainId}`,
        scores: new Array(SLOT_OFFSETS_HOURS.length).fill(0),
      });
    }

    const forecastTime = new Date(forecast.forecast_time).getTime();
    const hoursFromNow = (forecastTime - now) / 3_600_000;
    const slotIndex = Math.floor(hoursFromNow / 6);
    if (slotIndex < 0 || slotIndex >= SLOT_OFFSETS_HOURS.length) {
      continue;
    }

    const row = trainMap.get(trainId);
    if (!row) continue;
    row.scores[slotIndex] = Math.max(row.scores[slotIndex], forecast.demand_score);
  }

  return [...trainMap.values()]
    .slice(0, 8)
    .map((row) => ({
      ...row,
      scores: row.scores.map((score) => (score > 0 ? score : 0.15)),
    }));
}

function demandColor(score: number) {
  if (score > 0.8) return "bg-red-600";
  if (score > 0.6) return "bg-orange-500";
  if (score > 0.4) return "bg-amber-500";
  if (score > 0.2) return "bg-emerald-600";
  return "bg-blue-700";
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [disruptions, setDisruptions] = useState<Disruption[]>([]);
  const [liveStatuses, setLiveStatuses] = useState<LiveStatusRecord[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [syncingLiveRoutes, setSyncingLiveRoutes] = useState(false);
  const [syncingLiveStatus, setSyncingLiveStatus] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<string | null>(null);
  const { toast } = useToast();

  const REFRESH_INTERVAL = parseInt(import.meta.env.VITE_DASHBOARD_REFRESH_MS || "15000");

  const load = useCallback(async () => {
    try {
      const [dash, disr, liveStatus, forecastPayload] = await Promise.all([
        backend.railmind.getDashboard(),
        backend.railmind.listDisruptions(),
        backend.railmind.listLiveStatus(),
        backend.railmind.listForecasts({}),
      ]);
      setStats(dash);
      setDisruptions(disr.disruptions.filter((d) => d.status === "active").slice(0, 3));
      setLiveStatuses((liveStatus.statuses as LiveStatusRecord[]).slice(0, 5));
      setHeatmap(buildHeatmapData(forecastPayload.forecasts as ForecastRecord[]));
      setLastRefreshTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
      toast({ title: "Error loading dashboard", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [load, REFRESH_INTERVAL]);

  const runOptimization = async () => {
    setOptimizing(true);
    try {
      await Promise.all([
        backend.railmind.reallocate({ trainId: 1, reason: "Full optimization run" }),
        backend.railmind.generateForecasts(),
      ]);
      toast({ title: "Optimization complete", description: "Coaches reallocated and forecasts regenerated" });
      load();
    } catch (err) {
      console.error(err);
      toast({ title: "Optimization failed", variant: "destructive" });
    } finally {
      setOptimizing(false);
    }
  };

  const syncLiveRoutes = async () => {
    setSyncingLiveRoutes(true);
    try {
      const result = await backend.railmind.syncLiveRoutes();
      toast({
        title: "Live routes synced",
        description: `${result.synced}/${result.total} routes fetched from OpenStreetMap railway data`,
      });
      await load();
    } catch (err) {
      console.error(err);
      toast({ title: "Live route sync failed", variant: "destructive" });
    } finally {
      setSyncingLiveRoutes(false);
    }
  };

  const syncLiveStatus = async () => {
    setSyncingLiveStatus(true);
    try {
      const result = await backend.railmind.syncLiveStatus();
      toast({
        title: "Live status synced",
        description: `${result.synced_external}/${result.total} trains updated from external providers`,
      });
      await load();
    } catch (err) {
      console.error(err);
      toast({ title: "Live status sync failed", variant: "destructive" });
    } finally {
      setSyncingLiveStatus(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Command Dashboard</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Real-time railway intelligence overview</p>
          {lastRefreshTime && (
            <p className="text-xs text-zinc-600 mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Last updated: {lastRefreshTime}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncLiveRoutes}
            disabled={syncingLiveRoutes}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncingLiveRoutes ? "animate-spin" : ""}`} />
            {syncingLiveRoutes ? "Syncing Routes..." : "Sync Live Railway Routes"}
          </button>
          <button
            onClick={syncLiveStatus}
            disabled={syncingLiveStatus}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncingLiveStatus ? "animate-spin" : ""}`} />
            {syncingLiveStatus ? "Syncing Status..." : "Sync Live Train Status"}
          </button>
          <button
            onClick={runOptimization}
            disabled={optimizing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {optimizing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {optimizing ? "Optimizing..." : "Run Full Optimization"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Trains" value={stats?.total_trains ?? 0} icon={Train} color="blue" subtitle="Active in network" />
        <KPICard
          title="Active Disruptions"
          value={stats?.active_disruptions ?? 0}
          icon={AlertTriangle}
          color={stats?.active_disruptions ? "red" : "emerald"}
          subtitle="Requiring attention"
        />
        <KPICard
          title="Coach Utilization"
          value={`${stats?.coaches_utilization_pct ?? 0}%`}
          icon={Activity}
          color="purple"
          subtitle={`${stats?.coaches_in_use}/${stats?.total_coaches} coaches`}
        />
        <KPICard
          title="Forecast Accuracy"
          value={`${stats?.forecast_accuracy_pct ?? 0}%`}
          icon={TrendingUp}
          color="emerald"
          subtitle="ML model confidence"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-200 font-medium">Live Railway Routes (OpenStreetMap)</p>
            <p className="text-xs text-zinc-500 mt-1">
              Synced {stats?.live_routes_synced ?? 0}/{stats?.live_routes_total ?? 0} routes
              {stats?.live_routes_last_sync ? ` • Last sync ${new Date(stats.live_routes_last_sync).toLocaleString()}` : " • Sync pending"}
            </p>
          </div>
          <SeverityBadge severity={stats?.live_routes_enabled ? "active" : "inactive"} />
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-200 font-medium">Live Train Status Providers</p>
            <p className="text-xs text-zinc-500 mt-1">
              {stats?.live_status_on_time ?? 0} on-time • {stats?.live_status_delayed ?? 0} delayed • {stats?.live_status_cancelled ?? 0} cancelled
            </p>
            <p className="text-[11px] text-zinc-600 mt-1">
              Providers: {(stats?.live_status_providers ?? []).join(", ") || "internal-estimator"}
              {stats?.live_status_last_sync ? ` • Last sync ${new Date(stats.live_status_last_sync).toLocaleString()}` : ""}
            </p>
          </div>
          <SeverityBadge severity={stats?.live_status_enabled ? "active" : "inactive"} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-zinc-300">Railway Network Map (Leaflet)</h3>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Low demand</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Medium</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />High</span>
            </div>
          </div>
          <NetworkGraph
            nodes={stats?.network_nodes ?? []}
            edges={stats?.network_edges ?? []}
            width={600}
            height={320}
          />
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Active Disruptions</h3>
          <div className="space-y-3">
            {disruptions.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-4">No active disruptions</p>
            )}
            {disruptions.map((d) => (
              <div key={d.id} className="p-3 bg-zinc-800 rounded-lg border border-zinc-700">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-zinc-200">{d.train_number} — {d.train_name}</span>
                  <SeverityBadge severity={d.severity} />
                </div>
                <p className="text-xs text-zinc-500 capitalize">{d.type.replace("_", " ")}</p>
                <p className="text-xs text-zinc-600 mt-1">{new Date(d.detected_at).toLocaleTimeString()}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-800">
            <h4 className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Live Train Status</h4>
            <div className="space-y-2">
              {liveStatuses.length === 0 && (
                <p className="text-xs text-zinc-600">No live status records available</p>
              )}
              {liveStatuses.map((status) => (
                <div key={status.train_id} className="p-2.5 bg-zinc-800 rounded-lg border border-zinc-700">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-200">{status.train_number} - {status.train_name}</span>
                    <SeverityBadge severity={status.status} />
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {status.current_station_code ? `${status.current_station_code} • ` : ""}
                    {status.delay_minutes != null && status.delay_minutes > 0 ? `${status.delay_minutes} min delay` : "No delay"}
                  </p>
                  <p className="text-[11px] text-zinc-600 mt-1">{status.provider} • {new Date(status.fetched_at).toLocaleTimeString()}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-500">Deadhead Reduction</span>
              <span className="text-xs font-semibold text-emerald-400">{stats?.deadhead_reduction_pct}%</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-700"
                style={{ width: `${stats?.deadhead_reduction_pct ?? 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">72-Hour Demand Heatmap</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left text-zinc-500 pb-2 pr-4 font-medium">Train</th>
                {timeSlots.map((slot) => (
                  <th key={slot} className="text-center text-zinc-500 pb-2 px-1 font-medium">{slot}</th>
                ))}
              </tr>
            </thead>
            <tbody className="space-y-1">
              {heatmap.map((row) => (
                <tr key={row.id}>
                  <td className="text-zinc-400 pr-4 py-1 font-mono">{row.label}</td>
                  {row.scores.map((score, i) => (
                    <td key={i} className="px-1 py-1">
                      <div
                        className={`w-full h-7 rounded ${demandColor(score)} flex items-center justify-center text-white font-semibold text-xs opacity-90`}
                        title={`Demand: ${Math.round(score * 100)}%`}
                      >
                        {Math.round(score * 100)}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
