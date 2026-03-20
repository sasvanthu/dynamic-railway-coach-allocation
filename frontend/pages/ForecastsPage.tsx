import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Info, Clock } from "lucide-react";
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

const SLOT_OFFSETS_HOURS = Array.from({ length: 12 }, (_, index) => index * 6);

type HeatmapBucket = {
  scoreSum: number;
  count: number;
  factorSums: Record<string, number>;
};

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function normalizeFactors(forecast: Forecast) {
  const raw = forecast.factors ?? {};
  const eventImpact = toFiniteNumber(raw.event_boost ?? raw.event_impact);
  const historicalAvg = toFiniteNumber(raw.historical ?? raw.historical_avg);
  const weather = toFiniteNumber(raw.weather);
  const sentiment = toFiniteNumber(raw.sentiment, 0.05);
  const timeOfDay = toFiniteNumber(raw.time_of_day);

  return {
    demand_forecast: clamp01(forecast.demand_score * 0.45 + timeOfDay),
    event_impact: clamp01(eventImpact),
    historical_avg: clamp01(historicalAvg),
    weather: clamp01(weather),
    sentiment: clamp01(sentiment),
  };
}

function averageFactors(factorSums: Record<string, number>, count: number): Record<string, number> {
  if (!count) {
    return {
      demand_forecast: 0,
      event_impact: 0,
      historical_avg: 0,
      weather: 0,
      sentiment: 0,
    };
  }

  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(factorSums)) {
    result[key] = clamp01(value / count);
  }
  return result;
}

export default function ForecastsPage() {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<string | null>(null);
  const { toast } = useToast();

  const REFRESH_INTERVAL = parseInt(import.meta.env.VITE_FORECASTS_REFRESH_MS || "30000");

  const load = useCallback(async () => {
    try {
      const [f, e] = await Promise.all([
        backend.railmind.listForecasts({}),
        backend.railmind.listEvents(),
      ]);
      setForecasts(f.forecasts);
      setEvents(e.events);
      setLastRefreshTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to load forecasts", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [load, REFRESH_INTERVAL]);

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

  const slotLabels = SLOT_OFFSETS_HOURS.map((offset) => `T+${offset}h`);

  const now = Date.now();
  const bucketsByTrain = new Map<number, Map<number, HeatmapBucket>>();
  const baselineByTrain = new Map<number, HeatmapBucket>();

  for (const forecast of forecasts) {
    const slotMap = bucketsByTrain.get(forecast.train_id) ?? new Map<number, HeatmapBucket>();
    const baseline = baselineByTrain.get(forecast.train_id) ?? { scoreSum: 0, count: 0, factorSums: {} };
    const factors = normalizeFactors(forecast);

    baseline.scoreSum += forecast.demand_score;
    baseline.count += 1;
    for (const [key, value] of Object.entries(factors)) {
      baseline.factorSums[key] = (baseline.factorSums[key] ?? 0) + value;
    }
    baselineByTrain.set(forecast.train_id, baseline);

    const forecastTime = new Date(forecast.forecast_time).getTime();
    const hoursFromNow = (forecastTime - now) / 3_600_000;
    const slotIndex = Math.floor(hoursFromNow / 6);
    if (slotIndex < 0 || slotIndex >= SLOT_OFFSETS_HOURS.length) {
      bucketsByTrain.set(forecast.train_id, slotMap);
      continue;
    }

    const bucket = slotMap.get(slotIndex) ?? { scoreSum: 0, count: 0, factorSums: {} };
    bucket.scoreSum += forecast.demand_score;
    bucket.count += 1;
    for (const [key, value] of Object.entries(factors)) {
      bucket.factorSums[key] = (bucket.factorSums[key] ?? 0) + value;
    }
    slotMap.set(slotIndex, bucket);
    bucketsByTrain.set(forecast.train_id, slotMap);
  }

  const trainIds = [...new Set(forecasts.map((forecast) => forecast.train_id))].slice(0, 8);
  const trainMap = new Map(forecasts.map((forecast) => [forecast.train_id, { number: forecast.train_number, name: forecast.train_name }]));

  const getCellData = (trainId: number, slotIndex: number) => {
    const slotBucket = bucketsByTrain.get(trainId)?.get(slotIndex);
    if (slotBucket && slotBucket.count > 0) {
      return {
        score: clamp01(slotBucket.scoreSum / slotBucket.count),
        factors: averageFactors(slotBucket.factorSums, slotBucket.count),
      };
    }

    const baseline = baselineByTrain.get(trainId);
    if (baseline && baseline.count > 0) {
      return {
        score: clamp01(baseline.scoreSum / baseline.count),
        factors: averageFactors(baseline.factorSums, baseline.count),
      };
    }

    return {
      score: 0,
      factors: {
        demand_forecast: 0,
        event_impact: 0,
        historical_avg: 0,
        weather: 0,
        sentiment: 0,
      },
    };
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
          {lastRefreshTime && (
            <p className="text-xs text-zinc-600 mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Last updated: {lastRefreshTime}
            </p>
          )}
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
                {slotLabels.map((slot, i) => (
                  <th key={i} className="text-center text-zinc-500 pb-2 px-0.5 font-medium w-16">
                    <div>{slot}</div>
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
                    {slotLabels.map((slot, si) => {
                      const cell = getCellData(trainId, si);
                      const score = cell.score;
                      return (
                        <td key={si} className="px-0.5 py-0.5">
                          <div
                            className="w-full h-9 rounded cursor-pointer hover:opacity-80 hover:ring-1 hover:ring-white/20 flex items-center justify-center text-white font-bold transition-all"
                            style={{ background: demandBg(score) }}
                            onClick={() => setSelectedCell({ trainName: info?.name ?? `Train ${trainId}`, slot, score, factors: cell.factors })}
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
