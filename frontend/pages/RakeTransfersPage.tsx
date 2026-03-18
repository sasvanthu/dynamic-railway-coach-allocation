import { useEffect, useState } from "react";
import { CheckCircle, Zap, ArrowRight } from "lucide-react";
import backend from "~backend/client";
import LoadingSpinner from "../components/LoadingSpinner";
import SeverityBadge from "../components/SeverityBadge";
import { useToast } from "@/components/ui/use-toast";

interface RakeTransfer {
  id: number;
  from_zone: string;
  to_zone: string;
  coach_ids: number[];
  scheduled_at: string;
  status: string;
  estimated_savings_km: number;
}

const zones = ["North", "South", "East", "West", "Central"];

const zonePositions: Record<string, { cx: number; cy: number }> = {
  North: { cx: 50, cy: 12 },
  South: { cx: 50, cy: 80 },
  East: { cx: 85, cy: 45 },
  West: { cx: 15, cy: 45 },
  Central: { cx: 50, cy: 46 },
};

const zoneColors: Record<string, string> = {
  North: "#3b82f6",
  South: "#10b981",
  East: "#f59e0b",
  West: "#8b5cf6",
  Central: "#ec4899",
};

export default function RakeTransfersPage() {
  const [transfers, setTransfers] = useState<RakeTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<number | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    try {
      const r = await backend.railmind.listRakeTransfers();
      setTransfers(r.rake_transfers);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to load rake transfers", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (id: number) => {
    setApproving(id);
    try {
      await backend.railmind.approveRakeTransfer({ id });
      toast({ title: "Transfer approved", description: "Rake transfer scheduled for execution" });
      load();
    } catch (err) {
      console.error(err);
      toast({ title: "Approval failed", variant: "destructive" });
    } finally {
      setApproving(null);
    }
  };

  const optimize = async () => {
    setOptimizing(true);
    try {
      const r = await backend.railmind.optimizeRakeTransfers();
      toast({ title: "Optimization complete", description: `${r.proposals_created} new proposals, ${Math.round(r.total_savings_km)} km savings` });
      load();
    } catch (err) {
      console.error(err);
      toast({ title: "Optimization failed", variant: "destructive" });
    } finally {
      setOptimizing(false);
    }
  };

  const totalSavings = transfers.filter((t) => t.status !== "proposed").reduce((a, b) => a + b.estimated_savings_km, 0);
  const projectedSavings = transfers.filter((t) => t.status === "proposed").reduce((a, b) => a + b.estimated_savings_km, 0);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Rake Transfer Optimization</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Graph-based cross-zone coach redistribution engine</p>
        </div>
        <button
          onClick={optimize}
          disabled={optimizing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Zap className="w-4 h-4" />
          {optimizing ? "Optimizing..." : "Run Optimizer"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-emerald-500/20 rounded-xl p-4 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Realized Savings</p>
          <p className="text-3xl font-bold text-emerald-400">{Math.round(totalSavings).toLocaleString()} km</p>
          <p className="text-xs text-zinc-600 mt-1">deadhead reduced</p>
        </div>
        <div className="bg-zinc-900 border border-blue-500/20 rounded-xl p-4 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Projected Savings</p>
          <p className="text-3xl font-bold text-blue-400">{Math.round(projectedSavings).toLocaleString()} km</p>
          <p className="text-xs text-zinc-600 mt-1">if all proposals approved</p>
        </div>
        <div className="bg-zinc-900 border border-purple-500/20 rounded-xl p-4 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total Proposals</p>
          <p className="text-3xl font-bold text-purple-400">{transfers.length}</p>
          <p className="text-xs text-zinc-600 mt-1">{transfers.filter((t) => t.status === "proposed").length} pending approval</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Zone Network Visualization</h3>
          <svg viewBox="0 0 100 100" className="w-full" style={{ height: 300 }}>
            {transfers.map((t, i) => {
              const from = zonePositions[t.from_zone];
              const to = zonePositions[t.to_zone];
              if (!from || !to) return null;
              const isProposed = t.status === "proposed";
              return (
                <g key={i}>
                  <defs>
                    <marker id={`arrow-${i}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={isProposed ? "#3b82f6" : "#10b981"} />
                    </marker>
                  </defs>
                  <line
                    x1={from.cx} y1={from.cy} x2={to.cx} y2={to.cy}
                    stroke={isProposed ? "#3b82f6" : "#10b981"}
                    strokeWidth="0.8"
                    strokeOpacity={0.8}
                    strokeDasharray={isProposed ? "2 1.5" : "none"}
                    markerEnd={`url(#arrow-${i})`}
                    className={isProposed ? "animate-pulse" : ""}
                  />
                  <text
                    x={(from.cx + to.cx) / 2 + 2} y={(from.cy + to.cy) / 2 - 1}
                    fontSize="3.5" fill="#94a3b8" textAnchor="middle"
                  >
                    {(t.coach_ids as number[]).length}🚃
                  </text>
                </g>
              );
            })}
            {zones.map((zone) => {
              const pos = zonePositions[zone];
              if (!pos) return null;
              return (
                <g key={zone}>
                  <polygon
                    points={`${pos.cx},${pos.cy - 7} ${pos.cx + 6},${pos.cy - 3.5} ${pos.cx + 6},${pos.cy + 3.5} ${pos.cx},${pos.cy + 7} ${pos.cx - 6},${pos.cy + 3.5} ${pos.cx - 6},${pos.cy - 3.5}`}
                    fill={zoneColors[zone] + "30"}
                    stroke={zoneColors[zone]}
                    strokeWidth="0.8"
                  />
                  <text x={pos.cx} y={pos.cy + 1.5} textAnchor="middle" fontSize="4" fontWeight="bold" fill="#e4e4e7">{zone[0]}</text>
                  <text x={pos.cx} y={pos.cy + 11} textAnchor="middle" fontSize="3.5" fill="#71717a">{zone}</text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="space-y-3">
          {transfers.map((t) => (
            <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-200">{t.from_zone}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="font-semibold text-zinc-200">{t.to_zone}</span>
                  <SeverityBadge severity={t.status} />
                </div>
                {t.status === "proposed" && (
                  <button
                    onClick={() => approve(t.id)}
                    disabled={approving === t.id}
                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium rounded-lg transition-colors"
                  >
                    <CheckCircle className="w-3 h-3" />
                    {approving === t.id ? "Approving..." : "Approve"}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span>{(t.coach_ids as number[]).length} coaches</span>
                <span>·</span>
                <span className="text-emerald-400 font-semibold">~{Math.round(t.estimated_savings_km)} km saved</span>
                <span>·</span>
                <span>{new Date(t.scheduled_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
