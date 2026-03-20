import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Network, Zap, TrendingDown } from "lucide-react";
import KPICard from "../components/KPICard";
import LoadingSpinner from "../components/LoadingSpinner";
import backend from "~backend/client";
import { useToast } from "@/components/ui/use-toast";

interface CascadeEvent {
  id: number;
  primary_disruption_id: number;
  cascade_level: number;
  affected_trains: number;
  detection_time: string;
  mitigation_status: string;
  affected_regions: string[];
  confidence: number;
}

interface CascadeMetrics {
  active_cascades: number;
  prevented_cascades: number;
  avg_detection_time_minutes: number;
  mitigation_success_rate_pct: number;
}

interface Disruption {
  id: number;
  train_id: number;
  severity: string;
  status: string;
  detected_at: string;
  cascade_impact?: {
    affected_trains?: number[];
  };
}

interface TrainSummary {
  id: number;
  origin: string;
  destination: string;
}

interface StationSummary {
  code: string;
  zone: string;
}

const REFRESH_INTERVAL = Math.max(10_000, Number(import.meta.env.VITE_CASCADE_REFRESH_MS ?? 20_000));

const severityScore: Record<string, number> = {
  critical: 1,
  high: 0.8,
  medium: 0.65,
  low: 0.5,
};

function levelFromInputs(affectedTrains: number, severity: string) {
  const severityBase = severity === "critical" ? 3 : severity === "high" ? 2 : 1;
  if (affectedTrains >= 5) return 3;
  if (affectedTrains >= 3) return Math.max(2, severityBase);
  return Math.max(1, Math.min(3, severityBase));
}

export default function CascadeDisruptionPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<CascadeMetrics | null>(null);
  const [cascades, setCascades] = useState<CascadeEvent[]>([]);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const [disruptionsPayload, trainsPayload, stationsPayload] = await Promise.all([
      backend.railmind.listDisruptions(),
      backend.railmind.listTrains(),
      backend.railmind.listStations(),
    ]);

    const disruptions = disruptionsPayload.disruptions as Disruption[];
    const trains = trainsPayload.trains as TrainSummary[];
    const stations = stationsPayload.stations as StationSummary[];

    const trainById = new Map<number, TrainSummary>(trains.map((train) => [train.id, train]));
    const zoneByStationCode = new Map<string, string>(stations.map((station) => [station.code, station.zone]));

    const cascadeRows = disruptions.map((disruption) => {
      const affectedTrainIds = disruption.cascade_impact?.affected_trains?.length
        ? disruption.cascade_impact.affected_trains
        : [disruption.train_id];

      const zones = new Set<string>();
      for (const trainId of affectedTrainIds) {
        const train = trainById.get(trainId);
        if (!train) continue;
        const originZone = zoneByStationCode.get(train.origin);
        const destinationZone = zoneByStationCode.get(train.destination);
        if (originZone) zones.add(originZone);
        if (destinationZone) zones.add(destinationZone);
      }

      const affectedTrains = affectedTrainIds.length;
      const confidence = Math.min(0.99, 0.5 + (severityScore[disruption.severity] ?? 0.5) * 0.35 + Math.min(0.14, affectedTrains * 0.03));

      return {
        id: disruption.id,
        primary_disruption_id: disruption.id,
        cascade_level: levelFromInputs(affectedTrains, disruption.severity),
        affected_trains: affectedTrains,
        detection_time: disruption.detected_at,
        mitigation_status: disruption.status === "resolved" ? "resolved" : disruption.severity === "critical" ? "escalating" : "mitigating",
        affected_regions: zones.size ? [...zones] : ["Unknown"],
        confidence,
      } satisfies CascadeEvent;
    });

    const active = cascadeRows.filter((row) => row.mitigation_status !== "resolved");
    const resolved = cascadeRows.filter((row) => row.mitigation_status === "resolved");

    const avgDetectionTimeMinutes = active.length
      ? Math.max(
          1,
          Math.round(
            active.reduce((sum, row) => {
              const detected = new Date(row.detection_time).getTime();
              return sum + (Number.isFinite(detected) ? Math.max(1, (Date.now() - detected) / 60_000) : 1);
            }, 0) / active.length
          )
        )
      : 0;

    const mitigationSuccess = cascadeRows.length ? Math.round((resolved.length / cascadeRows.length) * 100) : 0;

    setMetrics({
      active_cascades: active.length,
      prevented_cascades: resolved.length,
      avg_detection_time_minutes: avgDetectionTimeMinutes,
      mitigation_success_rate_pct: mitigationSuccess,
    });
    setCascades(cascadeRows);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await load();
      } catch (error) {
        console.error("Error fetching cascade data:", error);
        toast({ title: "Failed to load cascade disruptions", variant: "destructive" });
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
          <Network className="w-8 h-8 text-orange-500" />
          Proactive Cascade Disruption Engine
        </h1>
        <p className="text-zinc-400 mt-2">Predict and prevent network-wide cascade failures before they happen</p>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard
            title="Active Cascades"
            value={metrics.active_cascades.toString()}
            icon={AlertTriangle}
            delta="-3%"
          />
          <KPICard
            title="Prevented Cascades"
            value={metrics.prevented_cascades.toString()}
            icon={TrendingDown}
            delta="+8%"
          />
          <KPICard
            title="Avg Detection Time"
            value={`${metrics.avg_detection_time_minutes}min`}
            icon={Zap}
            delta="-2%"
          />
          <KPICard
            title="Mitigation Success Rate"
            value={`${metrics.mitigation_success_rate_pct}%`}
            icon={Network}
            delta="+5%"
          />
        </div>
      )}

      <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Network className="w-5 h-5 text-orange-500" />
            Cascade Events
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-800/50">
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Event ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Primary Disruption</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Cascade Level</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Affected Trains</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Regions</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Confidence</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Status</th>
              </tr>
            </thead>
            <tbody>
              {cascades.map((cascade) => (
                <tr key={cascade.id} className="border-b border-zinc-800 hover:bg-zinc-800/30 transition">
                  <td className="px-6 py-4 text-sm font-mono text-zinc-100">#{cascade.id}</td>
                  <td className="px-6 py-4 text-sm text-zinc-300">#{cascade.primary_disruption_id}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-block px-3 py-1 rounded font-semibold text-xs ${
                        cascade.cascade_level >= 3
                          ? "bg-red-900/40 text-red-400"
                          : cascade.cascade_level === 2
                          ? "bg-orange-900/40 text-orange-400"
                          : "bg-amber-900/40 text-amber-400"
                      }`}
                    >
                      Level {cascade.cascade_level}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-300">{cascade.affected_trains} trains</td>
                  <td className="px-6 py-4 text-sm text-zinc-400">
                    {cascade.affected_regions.join(", ")}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-2 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${cascade.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-zinc-300">{(cascade.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        cascade.mitigation_status === "resolved"
                          ? "bg-emerald-900/40 text-emerald-400"
                          : "bg-amber-900/40 text-amber-400"
                      }`}
                    >
                      {cascade.mitigation_status}
                    </span>
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
