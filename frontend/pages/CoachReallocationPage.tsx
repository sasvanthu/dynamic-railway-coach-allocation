import { useEffect, useState } from "react";
import { Clock, Zap, TrendingUp, AlertCircle } from "lucide-react";
import KPICard from "../components/KPICard";
import LoadingSpinner from "../components/LoadingSpinner";
import backend from "~backend/client";

interface ReallocationEvent {
  id: number;
  timestamp: string;
  coach_id: string;
  from_train: string;
  to_train: string;
  reason: string;
  impact_score: number;
  status: string;
}

interface ReallocationMetrics {
  reallocations_today: number;
  reallocations_in_progress: number;
  avg_reallocation_time_minutes: number;
  coaches_optimized: number;
  capacity_optimization_pct: number;
}

export default function CoachReallocationPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ReallocationMetrics | null>(null);
  const [events, setEvents] = useState<ReallocationEvent[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Simulated data - replace with actual API calls
        setMetrics({
          reallocations_today: 42,
          reallocations_in_progress: 3,
          avg_reallocation_time_minutes: 12,
          coaches_optimized: 156,
          capacity_optimization_pct: 94,
        });
        
        setEvents([
          {
            id: 1,
            timestamp: new Date().toISOString(),
            coach_id: "C-12345",
            from_train: "12051",
            to_train: "12052",
            reason: "Demand surge detected",
            impact_score: 0.95,
            status: "completed",
          },
          {
            id: 2,
            timestamp: new Date(Date.now() - 600000).toISOString(),
            coach_id: "C-12346",
            from_train: "12053",
            to_train: "12054",
            reason: "Capacity optimization",
            impact_score: 0.87,
            status: "completed",
          },
          {
            id: 3,
            timestamp: new Date(Date.now() - 120000).toISOString(),
            coach_id: "C-12347",
            from_train: "12055",
            to_train: "12056",
            reason: "Proactive reallocation",
            impact_score: 0.92,
            status: "in_progress",
          },
        ]);
      } catch (error) {
        console.error("Error fetching reallocation data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Clock className="w-8 h-8 text-blue-500" />
          15-Minute Dynamic Coach Reallocation
        </h1>
        <p className="text-zinc-400 mt-2">Real-time coach optimization and reallocation engine</p>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <KPICard
            title="Reallocations Today"
            value={metrics.reallocations_today.toString()}
            icon={Zap}
            trend={12}
          />
          <KPICard
            title="In Progress"
            value={metrics.reallocations_in_progress.toString()}
            icon={TrendingUp}
            trend={0}
          />
          <KPICard
            title="Avg Time"
            value={`${metrics.avg_reallocation_time_minutes}min`}
            icon={Clock}
            trend={-5}
          />
          <KPICard
            title="Coaches Optimized"
            value={metrics.coaches_optimized.toString()}
            icon={AlertCircle}
            trend={8}
          />
          <KPICard
            title="Capacity Optimization"
            value={`${metrics.capacity_optimization_pct}%`}
            icon={TrendingUp}
            trend={3}
          />
        </div>
      )}

      <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Recent Reallocation Events
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-800/50">
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Coach ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">From Train</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">To Train</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Reason</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Impact Score</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-zinc-800 hover:bg-zinc-800/30 transition">
                  <td className="px-6 py-4 text-sm font-mono text-zinc-100">{event.coach_id}</td>
                  <td className="px-6 py-4 text-sm text-zinc-300">{event.from_train}</td>
                  <td className="px-6 py-4 text-sm text-zinc-300">{event.to_train}</td>
                  <td className="px-6 py-4 text-sm text-zinc-400">{event.reason}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${event.impact_score * 100}%` }}
                        />
                      </div>
                      <span className="text-zinc-300">{(event.impact_score * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        event.status === "completed"
                          ? "bg-emerald-900/40 text-emerald-400"
                          : "bg-amber-900/40 text-amber-400"
                      }`}
                    >
                      {event.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
