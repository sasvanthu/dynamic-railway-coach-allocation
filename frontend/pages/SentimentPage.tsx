import { useEffect, useState } from "react";
import { RefreshCw, Radio } from "lucide-react";
import backend from "~backend/client";
import LoadingSpinner from "../components/LoadingSpinner";
import { useToast } from "@/components/ui/use-toast";

interface SentimentRecord {
  id: number;
  station_id: number;
  source: string;
  score: number;
  crowd_density: number;
  message: string;
  recorded_at: string;
  station_code: string | null;
  station_name: string | null;
}

const sourceConfig: Record<string, { label: string; color: string; icon: string }> = {
  cctv: { label: "CCTV", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: "📷" },
  social: { label: "Social", color: "text-purple-400 bg-purple-500/10 border-purple-500/20", icon: "📱" },
  kiosk: { label: "Kiosk", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: "🖥️" },
};

function Sparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null;
  const h = 32;
  const w = 80;
  const maxS = Math.max(...scores, 0.01);
  const pts = scores.map((s, i) => `${(i / (scores.length - 1)) * w},${h - (s / maxS) * h}`).join(" ");
  const areaBase = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg width={w} height={h} className="opacity-80">
      <polyline points={areaBase} fill="#3b82f620" stroke="none" />
      <polyline points={pts} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SentimentPage() {
  const [records, setRecords] = useState<SentimentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    try {
      const r = await backend.railmind.listSentiment();
      setRecords(r.sentiment);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to load sentiment", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const simulate = async () => {
    setSimulating(true);
    try {
      await backend.railmind.simulateSentiment();
      toast({ title: "New readings simulated", description: "CCTV, social, and kiosk data updated" });
      load();
    } catch (err) {
      console.error(err);
      toast({ title: "Simulation failed", variant: "destructive" });
    } finally {
      setSimulating(false);
    }
  };

  const stationMap = new Map<string, SentimentRecord[]>();
  for (const r of records) {
    const key = r.station_code ?? `${r.station_id}`;
    if (!stationMap.has(key)) stationMap.set(key, []);
    stationMap.get(key)!.push(r);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Sentiment Intelligence</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Multi-source crowd sentiment and density analytics</p>
        </div>
        <button
          onClick={simulate}
          disabled={simulating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${simulating ? "animate-spin" : ""}`} />
          {simulating ? "Simulating..." : "Simulate New Readings"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Radio className="w-4 h-4 text-red-400 animate-pulse" />
              <h3 className="text-sm font-semibold text-zinc-300">Live Sentiment Feed</h3>
            </div>
            <div className="space-y-2.5 max-h-80 overflow-y-auto">
              {records.map((r) => {
                const src = sourceConfig[r.source] ?? { label: r.source, color: "text-zinc-400 bg-zinc-800 border-zinc-700", icon: "📊" };
                return (
                  <div key={r.id} className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg">
                    <span className="text-lg">{src.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs font-bold text-zinc-300">{r.station_code}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${src.color}`}>{src.label}</span>
                        <span className="text-xs text-zinc-600">{new Date(r.recorded_at).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs text-zinc-400 truncate">{r.message}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-sm font-bold ${r.score > 0.6 ? "text-emerald-400" : r.score > 0.35 ? "text-amber-400" : "text-red-400"}`}>
                        {Math.round(r.score * 100)}%
                      </div>
                      <div className="text-xs text-zinc-600">density: {Math.round(r.crowd_density * 100)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300">Per-Station Trends</h3>
          {[...stationMap.entries()].map(([code, recs]) => {
            const latest = recs[0];
            const scores = recs.map((r) => r.score).slice(0, 8).reverse();
            const avgScore = recs.reduce((a, b) => a + b.score, 0) / recs.length;
            const avgDensity = recs.reduce((a, b) => a + b.crowd_density, 0) / recs.length;
            return (
              <div key={code} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-mono font-bold text-zinc-200">{code}</span>
                    <p className="text-xs text-zinc-500">{latest.station_name}</p>
                  </div>
                  <Sparkline scores={scores} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-zinc-800 rounded p-2 text-center">
                    <p className="text-zinc-500">Sentiment</p>
                    <p className={`font-bold ${avgScore > 0.6 ? "text-emerald-400" : avgScore > 0.35 ? "text-amber-400" : "text-red-400"}`}>
                      {Math.round(avgScore * 100)}%
                    </p>
                  </div>
                  <div className="bg-zinc-800 rounded p-2 text-center">
                    <p className="text-zinc-500">Crowd</p>
                    <p className={`font-bold ${avgDensity > 0.7 ? "text-red-400" : avgDensity > 0.4 ? "text-amber-400" : "text-emerald-400"}`}>
                      {Math.round(avgDensity * 100)}%
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-zinc-600 mb-0.5">
                    <span>Platform density</span>
                    <span>{Math.round(avgDensity * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${avgDensity > 0.7 ? "bg-red-500" : avgDensity > 0.4 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${avgDensity * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
