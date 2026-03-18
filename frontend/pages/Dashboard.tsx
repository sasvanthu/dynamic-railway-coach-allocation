import { useEffect, useState } from "react";
import { Train, AlertTriangle, Activity, TrendingUp, Zap, RefreshCw } from "lucide-react";
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
  network_nodes: Array<{ id: number; code: string; name: string; zone: string; lat: number; lng: number; crowd_density: number }>;
  network_edges: Array<{ source: number; target: number; route_name: string; distance_km: number; demand_level: string }>;
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

const trainIds = [1, 2, 3, 4, 5, 6, 7, 8];
const timeSlots = ["T+6h", "T+12h", "T+18h", "T+24h", "T+30h", "T+36h"];

function generateHeatmapData() {
  return trainIds.map((id) => ({
    id,
    scores: timeSlots.map(() => Math.random()),
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
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [heatmap] = useState(generateHeatmapData);
  const { toast } = useToast();

  const load = async () => {
    try {
      const [dash, disr] = await Promise.all([
        backend.railmind.getDashboard(),
        backend.railmind.listDisruptions(),
      ]);
      setStats(dash);
      setDisruptions(disr.disruptions.filter((d) => d.status === "active").slice(0, 3));
    } catch (err) {
      console.error(err);
      toast({ title: "Error loading dashboard", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Command Dashboard</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Real-time railway intelligence overview</p>
        </div>
        <button
          onClick={runOptimization}
          disabled={optimizing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {optimizing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {optimizing ? "Optimizing..." : "Run Full Optimization"}
        </button>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-zinc-300">Zone Network Graph</h3>
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
                  <td className="text-zinc-400 pr-4 py-1 font-mono">Train {row.id}</td>
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
