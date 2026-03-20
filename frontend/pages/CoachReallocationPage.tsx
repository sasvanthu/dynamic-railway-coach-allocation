import { useCallback, useEffect, useState } from "react";
import { Clock, Zap, TrendingUp, AlertCircle } from "lucide-react";
import KPICard from "../components/KPICard";
import LoadingSpinner from "../components/LoadingSpinner";
import backend from "~backend/client";
import { useToast } from "@/components/ui/use-toast";

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

interface Allocation {
  id: number;
  train_id: number;
  coach_id: number;
  coach_number: string | null;
  train_number: string | null;
  allocated_at: string;
  allocated_reason: string;
}

interface TrainSummary {
  id: number;
  train_number: string;
}

interface CoachSummary {
  id: number;
  status: string;
}

interface Disruption {
  id: number;
  severity: string;
  status: string;
  detected_at: string;
  auto_suggestions: Array<{
    from_train: number;
    to_train: number;
    coaches: number;
    rationale: string;
  }>;
}

const severityWeight: Record<string, number> = {
  critical: 0.9,
  high: 0.8,
  medium: 0.65,
  low: 0.5,
};

const REFRESH_INTERVAL = Math.max(10_000, Number(import.meta.env.VITE_COACH_REALLOCATION_REFRESH_MS ?? 15_000));

function isSameDay(value: string, day: Date) {
  const date = new Date(value);
  return (
    date.getFullYear() === day.getFullYear() &&
    date.getMonth() === day.getMonth() &&
    date.getDate() === day.getDate()
  );
}

export default function CoachReallocationPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ReallocationMetrics | null>(null);
  const [events, setEvents] = useState<ReallocationEvent[]>([]);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const [allocationsPayload, trainsPayload, disruptionsPayload, coachesPayload] = await Promise.all([
      backend.railmind.listAllocations({}),
      backend.railmind.listTrains(),
      backend.railmind.listDisruptions(),
      backend.railmind.listCoaches({}),
    ]);

    const allocations = allocationsPayload.allocations as Allocation[];
    const trains = trainsPayload.trains as TrainSummary[];
    const disruptions = disruptionsPayload.disruptions as Disruption[];
    const coaches = coachesPayload.coaches as CoachSummary[];

    const trainNumberById = new Map<number, string>(trains.map((train) => [train.id, train.train_number]));

    const disruptionEvents = disruptions.flatMap((disruption) => {
      const suggestions = Array.isArray(disruption.auto_suggestions) ? disruption.auto_suggestions : [];
      return suggestions.map((suggestion, index) => {
        const baseImpact = severityWeight[disruption.severity] ?? 0.6;
        return {
          id: disruption.id * 100 + index,
          timestamp: disruption.detected_at,
          coach_id: `${suggestion.coaches} coach${suggestion.coaches > 1 ? "es" : ""}`,
          from_train: trainNumberById.get(suggestion.from_train) ?? `Train ${suggestion.from_train}`,
          to_train: trainNumberById.get(suggestion.to_train) ?? `Train ${suggestion.to_train}`,
          reason: suggestion.rationale,
          impact_score: Math.min(0.99, baseImpact + Math.min(0.15, suggestion.coaches * 0.03)),
          status: disruption.status === "active" ? "in_progress" : "completed",
        } satisfies ReallocationEvent;
      });
    });

    const allocationFallback = allocations.slice(0, 8).map((allocation, index) => ({
      id: allocation.id + index,
      timestamp: allocation.allocated_at,
      coach_id: allocation.coach_number ?? `Coach ${allocation.coach_id}`,
      from_train: "Reserve Pool",
      to_train: allocation.train_number ?? `Train ${allocation.train_id}`,
      reason: allocation.allocated_reason,
      impact_score: 0.6,
      status: "completed",
    }));

    const finalEvents = (disruptionEvents.length ? disruptionEvents : allocationFallback)
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
      .slice(0, 12);

    const now = new Date();
    const reallocationsToday = allocations.filter((allocation) => isSameDay(allocation.allocated_at, now)).length;
    const reallocationsInProgress = finalEvents.filter((event) => event.status === "in_progress").length;

    const avgReallocationTime = finalEvents.length
      ? Math.round(
          finalEvents.reduce((sum, event) => {
            const eventTime = new Date(event.timestamp).getTime();
            const ageMinutes = Number.isFinite(eventTime) ? Math.max(1, Math.round((Date.now() - eventTime) / 60_000)) : 1;
            return sum + ageMinutes;
          }, 0) / finalEvents.length
        )
      : 0;

    const coachesOptimized = new Set(allocations.map((allocation) => allocation.coach_id)).size;
    const inUseCoaches = coaches.filter((coach) => coach.status === "in_use").length;
    const capacityOptimizationPct = coaches.length ? Math.round((inUseCoaches / coaches.length) * 100) : 0;

    setMetrics({
      reallocations_today: reallocationsToday,
      reallocations_in_progress: reallocationsInProgress,
      avg_reallocation_time_minutes: avgReallocationTime,
      coaches_optimized: coachesOptimized,
      capacity_optimization_pct: capacityOptimizationPct,
    });
    setEvents(finalEvents);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await load();
      } catch (error) {
        console.error("Error fetching reallocation data:", error);
        toast({ title: "Failed to load coach reallocation feed", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
    const interval = setInterval(() => void fetchData(), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [load, toast]);

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
            delta="+12%"
          />
          <KPICard
            title="In Progress"
            value={metrics.reallocations_in_progress.toString()}
            icon={TrendingUp}
            delta="0%"
          />
          <KPICard
            title="Avg Time"
            value={`${metrics.avg_reallocation_time_minutes}min`}
            icon={Clock}
            delta="-5%"
          />
          <KPICard
            title="Coaches Optimized"
            value={metrics.coaches_optimized.toString()}
            icon={AlertCircle}
            delta="+8%"
          />
          <KPICard
            title="Capacity Optimization"
            value={`${metrics.capacity_optimization_pct}%`}
            icon={TrendingUp}
            delta="+3%"
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
