import { useCallback, useEffect, useState } from "react";
import { ChevronRight, RefreshCw, X, Zap, Clock } from "lucide-react";
import backend from "~backend/client";
import LoadingSpinner from "../components/LoadingSpinner";
import SeverityBadge from "../components/SeverityBadge";
import { useToast } from "@/components/ui/use-toast";

interface Train {
  id: number;
  train_number: string;
  name: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  status: string;
  coach_count: number;
  demand_score: number | null;
  route_name?: string | null;
  route_distance_km?: number | null;
  route_source?: string;
  route_last_synced_at?: string | null;
  live_delay_minutes?: number | null;
  live_status_source?: string;
  live_status_provider?: string;
  live_status_updated_at?: string | null;
}

interface CoachAllocation {
  id: number;
  coach_number: string;
  coach_type: string;
  capacity: number;
  position: number;
  allocated_reason: string;
  shap_factors: Record<string, number>;
}

interface TrainDetail {
  id: number;
  train_number: string;
  name: string;
  origin: string;
  destination: string;
  status: string;
  allocations: CoachAllocation[];
  live_route?: {
    route_name: string;
    distance_km: number;
    source: string;
    fetched_at: string;
  } | null;
  live_status?: {
    status: string;
    delay_minutes: number | null;
    source: string;
    provider: string;
    current_station_code?: string | null;
    current_station_name?: string | null;
    message?: string | null;
    fetched_at: string;
  } | null;
}

const coachColors: Record<string, string> = {
  AC1: "bg-purple-600",
  AC2: "bg-blue-600",
  AC3: "bg-cyan-600",
  SL: "bg-emerald-600",
  GEN: "bg-zinc-600",
};

const shapLabels: Record<string, string> = {
  demand_forecast: "Demand Forecast",
  event_impact: "Event Impact",
  historical_avg: "Historical Avg",
  weather: "Weather",
  sentiment: "Sentiment",
};

export default function TrainsPage() {
  const [trains, setTrains] = useState<Train[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TrainDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [injecting, setInjecting] = useState(false);
  const [syncingRoutes, setSyncingRoutes] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<string | null>(null);
  const { toast } = useToast();

  const REFRESH_INTERVAL = parseInt(import.meta.env.VITE_TRAINS_REFRESH_MS || "20000");

  const loadTrains = useCallback(async () => {
    try {
      const result = await backend.railmind.listTrains();
      setTrains(result.trains as Train[]);
      setLastRefreshTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to load trains", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadTrains();
    const interval = setInterval(() => void loadTrains(), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadTrains, REFRESH_INTERVAL]);

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const detail = await backend.railmind.getTrain({ id });
      setSelected(detail);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to load train detail", variant: "destructive" });
    } finally {
      setDetailLoading(false);
    }
  };

  const syncLiveRoutes = async () => {
    setSyncingRoutes(true);
    try {
      const result = await backend.railmind.syncLiveRoutes();
      toast({ title: "Live routes synced", description: `${result.synced}/${result.total} routes fetched from OpenStreetMap` });
      await loadTrains();
      if (selected) {
        const detail = await backend.railmind.getTrain({ id: selected.id, refresh: true });
        setSelected(detail as TrainDetail);
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to sync live routes", variant: "destructive" });
    } finally {
      setSyncingRoutes(false);
    }
  };

  const injectDisruption = async (trainId: number) => {
    setInjecting(true);
    try {
      await backend.railmind.injectDisruption({ trainId, type: "delay", severity: "high" });
      toast({ title: "Disruption injected", description: "A high-severity delay has been simulated" });
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to inject disruption", variant: "destructive" });
    } finally {
      setInjecting(false);
    }
  };

  const shapBars = (factors: Record<string, number>) => {
    const entries = Object.entries(factors).sort((a, b) => b[1] - a[1]);
    return entries.map(([key, val]) => (
      <div key={key} className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-zinc-400">{shapLabels[key] ?? key}</span>
          <span className="text-zinc-300 font-medium">{(val * 100).toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
            style={{ width: `${val * 100}%` }}
          />
        </div>
      </div>
    ));
  };

  const topFactor = (factors: Record<string, number>) => {
    const top = Object.entries(factors).sort((a, b) => b[1] - a[1])[0];
    return top ? shapLabels[top[0]] ?? top[0] : "demand forecast";
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Train Management</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Coach composition and allocation intelligence</p>
          {lastRefreshTime && (
            <p className="text-xs text-zinc-600 mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Last updated: {lastRefreshTime}
            </p>
          )}
        </div>
        <button
          onClick={syncLiveRoutes}
          disabled={syncingRoutes}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${syncingRoutes ? "animate-spin" : ""}`} />
          {syncingRoutes ? "Syncing Routes..." : "Sync Live Routes"}
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Train</th>
              <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Route</th>
              <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Departure</th>
              <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Status</th>
              <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Coaches</th>
              <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Demand</th>
              <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {trains.map((train, i) => (
              <tr
                key={train.id}
                className={`border-b border-zinc-800/50 hover:bg-zinc-800/40 cursor-pointer transition-colors ${i % 2 === 0 ? "" : "bg-zinc-900/50"}`}
                onClick={() => openDetail(train.id)}
              >
                <td className="px-4 py-3">
                  <div className="font-semibold text-zinc-200">{train.train_number}</div>
                  <div className="text-xs text-zinc-500">{train.name}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-zinc-400 font-mono text-xs">{train.origin} → {train.destination}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    {train.route_distance_km ? `${Math.round(train.route_distance_km)} km` : "Distance N/A"} • {train.route_source === "osm-live" ? "Live OSM route" : "Fallback geodesic"}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{new Date(train.departure_time).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <SeverityBadge severity={train.status} />
                  <div className="text-[11px] text-zinc-600 mt-1">
                    {train.live_delay_minutes != null && train.live_delay_minutes > 0
                      ? `${train.live_delay_minutes} min delay`
                      : "No delay"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-zinc-300 font-semibold">{train.coach_count}</span>
                  <span className="text-zinc-600 text-xs ml-1">coaches</span>
                </td>
                <td className="px-4 py-3">
                  {train.demand_score != null ? (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${train.demand_score > 0.7 ? "bg-red-500" : train.demand_score > 0.4 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${train.demand_score * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-400">{Math.round(train.demand_score * 100)}%</span>
                    </div>
                  ) : (
                    <span className="text-zinc-600 text-xs">N/A</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(selected || detailLoading) && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="w-full max-w-lg bg-zinc-900 border-l border-zinc-800 overflow-y-auto">
            {detailLoading ? (
              <LoadingSpinner />
            ) : selected ? (
              <div className="p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-100">{selected.train_number} — {selected.name}</h3>
                    <p className="text-sm text-zinc-500">{selected.origin} → {selected.destination}</p>
                    {selected.live_route && (
                      <p className="text-xs text-zinc-500 mt-1">
                        {Math.round(selected.live_route.distance_km)} km • {selected.live_route.source === "osm-live" ? "Live OSM route" : "Fallback"} • Synced {new Date(selected.live_route.fetched_at).toLocaleString()}
                      </p>
                    )}
                    {selected.live_status && (
                      <p className="text-xs text-zinc-500 mt-1">
                        Status {selected.live_status.status.replace("_", " ")} • {selected.live_status.delay_minutes ? `${selected.live_status.delay_minutes} min delay` : "No delay"}
                        {selected.live_status.current_station_code ? ` • Near ${selected.live_status.current_station_code}` : ""}
                        {` • ${selected.live_status.provider}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={selected.status} />
                    <button onClick={() => setSelected(null)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Coach Composition</h4>
                  <div className="flex flex-wrap gap-2">
                    {selected.allocations.map((a) => (
                      <div
                        key={a.id}
                        className={`${coachColors[a.coach_type] ?? "bg-zinc-600"} px-2 py-1.5 rounded text-white text-xs font-semibold flex flex-col items-center min-w-12`}
                        title={`${a.coach_number} — ${a.capacity} seats`}
                      >
                        <span>{a.coach_type}</span>
                        <span className="opacity-70 text-xs">{a.capacity}</span>
                      </div>
                    ))}
                  </div>
                  {selected.allocations.length === 0 && (
                    <p className="text-sm text-zinc-500">No coaches allocated</p>
                  )}
                </div>

                {selected.allocations[0]?.shap_factors && (
                  <div>
                    <h4 className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">SHAP Factor Analysis</h4>
                    <div className="space-y-3">
                      {shapBars(selected.allocations[0].shap_factors)}
                    </div>
                  </div>
                )}

                {selected.allocations[0]?.shap_factors && (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-xs text-blue-300">
                      <span className="font-semibold">AI Explanation: </span>
                      Coach count on <span className="font-semibold">{selected.name}</span> was set to{" "}
                      <span className="font-semibold">{selected.allocations.length}</span> primarily because of{" "}
                      <span className="font-semibold">{topFactor(selected.allocations[0].shap_factors)}</span>{" "}
                      contributing the highest decision weight in the MILP optimizer model.
                    </p>
                  </div>
                )}

                <button
                  onClick={() => injectDisruption(selected.id)}
                  disabled={injecting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 text-red-400 text-sm font-medium rounded-lg transition-colors"
                >
                  <Zap className="w-4 h-4" />
                  {injecting ? "Injecting..." : "Inject Disruption"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
