import { useEffect, useState } from "react";
import { CheckCircle, PlusCircle } from "lucide-react";
import backend from "~backend/client";
import LoadingSpinner from "../components/LoadingSpinner";
import SeverityBadge from "../components/SeverityBadge";
import { useToast } from "@/components/ui/use-toast";

interface Disruption {
  id: number;
  train_id: number;
  type: string;
  severity: string;
  detected_at: string;
  resolved_at: string | null;
  cascade_impact: { affected_trains?: number[]; estimated_delay_min?: number; coaches_to_reassign?: number };
  status: string;
  auto_suggestions: Array<{ type: string; from_train: number; to_train: number; coaches: number; rationale: string }>;
  train_number: string | null;
  train_name: string | null;
}

interface Train {
  id: number;
  train_number: string;
  name: string;
}

const severityBorder: Record<string, string> = {
  critical: "border-red-500/30 bg-red-500/5",
  high: "border-orange-500/30 bg-orange-500/5",
  medium: "border-amber-500/30 bg-amber-500/5",
  low: "border-blue-500/30 bg-blue-500/5",
};

export default function DisruptionsPage() {
  const [disruptions, setDisruptions] = useState<Disruption[]>([]);
  const [trains, setTrains] = useState<Train[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<number | null>(null);
  const [injectForm, setInjectForm] = useState({ trainId: "", type: "delay", severity: "medium" });
  const [injecting, setInjecting] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    try {
      const [d, t] = await Promise.all([
        backend.railmind.listDisruptions(),
        backend.railmind.listTrains(),
      ]);
      setDisruptions(d.disruptions as unknown as Disruption[]);
      setTrains(t.trains.map((tr) => ({ id: tr.id, train_number: tr.train_number, name: tr.name })));
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to load disruptions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resolve = async (id: number) => {
    setResolving(id);
    try {
      await backend.railmind.resolveDisruption({ id });
      toast({ title: "Disruption resolved", description: "Auto-suggestions applied successfully" });
      load();
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to resolve", variant: "destructive" });
    } finally {
      setResolving(null);
    }
  };

  const inject = async () => {
    if (!injectForm.trainId) return;
    setInjecting(true);
    try {
      await backend.railmind.injectDisruption({
        trainId: parseInt(injectForm.trainId),
        type: injectForm.type,
        severity: injectForm.severity,
      });
      toast({ title: "Disruption injected", description: "New synthetic disruption created" });
      load();
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to inject disruption", variant: "destructive" });
    } finally {
      setInjecting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Disruption Management</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Real-time incident tracking and AI-powered resolution</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-zinc-400">{disruptions.filter((d) => d.status === "active").length} Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {disruptions.map((d) => (
            <div key={d.id} className={`border rounded-xl p-5 ${severityBorder[d.severity] ?? "border-zinc-800 bg-zinc-900"}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-zinc-200">{d.train_number} — {d.train_name}</span>
                    <SeverityBadge severity={d.severity} />
                    <SeverityBadge severity={d.status} />
                  </div>
                  <p className="text-sm text-zinc-400 capitalize">{d.type.replace("_", " ")} detected {new Date(d.detected_at).toLocaleString()}</p>
                </div>
                {d.status === "active" && (
                  <button
                    onClick={() => resolve(d.id)}
                    disabled={resolving === d.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium rounded-lg transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {resolving === d.id ? "Resolving..." : "Resolve"}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-zinc-800/50 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-zinc-500">Affected Trains</p>
                  <p className="text-lg font-bold text-zinc-200">{d.cascade_impact?.affected_trains?.length ?? 0}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-zinc-500">Est. Delay</p>
                  <p className="text-lg font-bold text-zinc-200">{d.cascade_impact?.estimated_delay_min ?? 0}m</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-zinc-500">Coaches to Reassign</p>
                  <p className="text-lg font-bold text-zinc-200">{d.cascade_impact?.coaches_to_reassign ?? 0}</p>
                </div>
              </div>

              {d.auto_suggestions?.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-2">AI Recommendations</p>
                  <div className="space-y-2">
                    {d.auto_suggestions.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-blue-300 capitalize">{s.type.replace("_", " ")}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">{s.rationale}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <PlusCircle className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-300">Inject Synthetic Disruption</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Train</label>
              <select
                value={injectForm.trainId}
                onChange={(e) => setInjectForm({ ...injectForm, trainId: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2"
              >
                <option value="">Select train...</option>
                {trains.map((t) => (
                  <option key={t.id} value={t.id}>{t.train_number} — {t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Type</label>
              <select
                value={injectForm.type}
                onChange={(e) => setInjectForm({ ...injectForm, type: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2"
              >
                <option value="delay">Delay</option>
                <option value="cancellation">Cancellation</option>
                <option value="overcrowding">Overcrowding</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Severity</label>
              <select
                value={injectForm.severity}
                onChange={(e) => setInjectForm({ ...injectForm, severity: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <button
              onClick={inject}
              disabled={injecting || !injectForm.trainId}
              className="w-full px-4 py-2 bg-red-600/80 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {injecting ? "Injecting..." : "Inject Disruption"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
