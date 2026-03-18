import { useEffect, useState } from "react";
import { AlertTriangle, Network, Zap, TrendingDown } from "lucide-react";
import KPICard from "../components/KPICard";
import LoadingSpinner from "../components/LoadingSpinner";

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

export default function CascadeDisruptionPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<CascadeMetrics | null>(null);
  const [cascades, setCascades] = useState<CascadeEvent[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setMetrics({
          active_cascades: 2,
          prevented_cascades: 18,
          avg_detection_time_minutes: 4,
          mitigation_success_rate_pct: 92,
        });

        setCascades([
          {
            id: 1,
            primary_disruption_id: 101,
            cascade_level: 3,
            affected_trains: 7,
            detection_time: new Date(Date.now() - 600000).toISOString(),
            mitigation_status: "mitigating",
            affected_regions: ["Zone-A", "Zone-B"],
            confidence: 0.95,
          },
          {
            id: 2,
            primary_disruption_id: 102,
            cascade_level: 2,
            affected_trains: 4,
            detection_time: new Date(Date.now() - 1200000).toISOString(),
            mitigation_status: "resolved",
            affected_regions: ["Zone-C"],
            confidence: 0.87,
          },
        ]);
      } catch (error) {
        console.error("Error fetching cascade data:", error);
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
            trend={-3}
          />
          <KPICard
            title="Prevented Cascades"
            value={metrics.prevented_cascades.toString()}
            icon={TrendingDown}
            trend={8}
          />
          <KPICard
            title="Avg Detection Time"
            value={`${metrics.avg_detection_time_minutes}min`}
            icon={Zap}
            trend={-2}
          />
          <KPICard
            title="Mitigation Success Rate"
            value={`${metrics.mitigation_success_rate_pct}%`}
            icon={Network}
            trend={5}
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
