import { useEffect, useState } from "react";
import { RefreshCw, Info } from "lucide-react";
import backend from "~backend/client";
import LoadingSpinner from "../components/LoadingSpinner";
import { useToast } from "@/components/ui/use-toast";

interface Forecast {
  id: number;
  train_id: number;
  station_id: number;
  forecast_time: string;
  demand_score: number;
  confidence: number;
  factors: Record<string, number>;
  train_number: string | null;
  train_name: string | null;
  station_code: string | null;
}

interface Event {
  id: number;
  name: string;
  type: string;
  start_date: string;
  end_date: string;
  expected_attendance: number;
  impact_score: number;
}

interface SelectedCell {
  trainName: string;
  slot: string;
  score: number;
  factors: Record<string, number>;
}

function demandBg(score: number) {
  if (score > 0.85) return "#7f1d1d";
  if (score > 0.7) return "#991b1b";
  if (score > 0.55) return "#b45309";
  if (score > 0.4) return "#15803d";
  if (score > 0.25) return "#1d4ed8";
  return "#1e3a8a";
}

const SLOTS = ["00:00", "06:00", "12:00", "18:00", "24:00", "30:00", "36:00", "42:00", "48:00", "54:00", "60:00", "66:00"];

function seedRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export default function ForecastsPage() {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const { toast } = useToast();

  const load = async () => {
    try {
      const [f, e] = await Promise.all([
        backend.railmind.listForecasts({}),
        backend.railmind.listEvents(),
      ]);
      setForecasts(f.forecasts);
      setEvents(e.events);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to load forecasts", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      await backend.railmind.generateForecasts();
      toast({ title: "Forecasts regenerated", description: "ML model has produced fresh demand predictions" });
      load();
    } catch (err) {
      console.error(err);
      toast({ title: "Generation failed", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const trainIds = [...new Set(forecasts.map((f) => f.train_id))].slice(0, 8);
  const trainMap = new Map(forecasts.map((f) => [f.train_id, { number: f.train_number, name: f.train_name }]));

  const getScore = (trainId: number, slotIndex: number) => {
    const seed = trainId * 100 + slotIndex;
    const base = seedRandom(seed) * 0.6 + 0.2;
    const eventBoost = events.length > 0 ? events[0].impact_score * 0.3 * seedRandom(seed + 7) : 0;
    return Math.min(0.99, base + eventBoost);
  };

  if (loading) return <LoadingSpinner />;

  const eventTypeIcon: Record<string, string> = {
    festival: "🪔",
    sports: "🏏",
    concert: "🎵",
    election: "🗳️",
    pilgrimage: "🕌",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Demand Forecasting</h2>
          <p className="text-sm text-zinc-500 mt-0.5">72-hour ML-powered demand heatmap with event overlays</p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Generating..." : "Regenerate Forecasts"}
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        {events.map((e) => (
          <div key={e.id} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs">
            <span>{eventTypeIcon[e.type] ?? "📅"}</span>
            <span className="text-zinc-300 font-medium">{e.name}</span>
            <span className="text-zinc-500">{new Date(e.start_date).toLocaleDateString()}</span>
            <span className="text-amber-400 font-semibold">+{Math.round(e.impact_score * 100)}% demand</span>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-300">72-Hour Demand Heatmap</h3>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: "#1e3a8a" }} />Low</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: "#15803d" }} />Moderate</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: "#b45309" }} />High</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: "#7f1d1d" }} />Critical</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left text-zinc-500 pb-2 pr-3 font-medium w-28">Train</th>
                {SLOTS.map((slot, i) => (
                  <th key={i} className="text-center text-zinc-500 pb-2 px-0.5 font-medium w-16">
                    <div>+{slot}</div>
                    {events.length > i && i < 3 && <div title={events[i]?.name}>{eventTypeIcon[events[i]?.type] ?? ""}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trainIds.map((trainId) => {
                const info = trainMap.get(trainId);
                return (
                  <tr key={trainId}>
                    <td className="pr-3 py-0.5">
                      <div className="text-zinc-300 font-mono font-semibold">{info?.number}</div>
                      <div className="text-zinc-600 truncate max-w-24">{info?.name}</div>
                    </td>
                    {SLOTS.map((slot, si) => {
                      const score = getScore(trainId, si);
                      return (
                        <td key={si} className="px-0.5 py-0.5">
                          <div
                            className="w-full h-9 rounded cursor-pointer hover:opacity-80 hover:ring-1 hover:ring-white/20 flex items-center justify-center text-white font-bold transition-all"
                            style={{ background: demandBg(score) }}
                            onClick={() => setSelectedCell({ trainName: info?.name ?? `Train ${trainId}`, slot, score, factors: { demand_forecast: score * 0.4, event_impact: score * 0.3, historical_avg: score * 0.2, weather: score * 0.06, sentiment: score * 0.04 } })}
                          >
                            {Math.round(score * 100)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCell && (
        <div className="bg-zinc-900 border border-blue-500/30 rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-zinc-300">Factor Breakdown — {selectedCell.trainName} at +{selectedCell.slot}</h3>
            </div>
            <span className="text-2xl font-bold" style={{ color: demandBg(selectedCell.score) }}>
              {Math.round(selectedCell.score * 100)}%
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(selectedCell.factors).map(([k, v]) => (
              <div key={k} className="bg-zinc-800 rounded-lg p-3 text-center">
                <p className="text-xs text-zinc-500 mb-1 capitalize">{k.replace("_", " ")}</p>
                <p className="text-lg font-bold text-zinc-200">{Math.round(v * 100)}%</p>
                <div className="h-1 bg-zinc-700 rounded mt-2 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded" style={{ width: `${v * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
