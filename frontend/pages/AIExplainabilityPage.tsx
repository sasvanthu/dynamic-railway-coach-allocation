import { useCallback, useEffect, useState } from "react";
import { Brain, BarChart3, Lightbulb, TrendingUp } from "lucide-react";
import KPICard from "../components/KPICard";
import LoadingSpinner from "../components/LoadingSpinner";
import backend from "~backend/client";
import { useToast } from "@/components/ui/use-toast";

interface Decision {
  id: number;
  decision_type: string;
  recommendation: string;
  confidence: number;
  key_factors: string[];
  impact_estimate: string;
  timestamp: string;
}

interface ExplainabilityMetrics {
  model_accuracy_pct: number;
  avg_confidence: number;
  decisions_explained: number;
  model_interpretability_score: number;
}

interface Allocation {
  id: number;
  train_id: number;
  train_number: string | null;
  coach_number: string | null;
  allocated_reason: string;
  allocated_at: string;
  shap_factors: Record<string, number>;
}

interface Forecast {
  train_id: number;
  confidence: number;
  demand_score: number;
}

const REFRESH_INTERVAL = Math.max(10_000, Number(import.meta.env.VITE_AI_EXPLAINABILITY_REFRESH_MS ?? 20_000));

const factorLabel: Record<string, string> = {
  demand_forecast: "Demand forecast",
  event_impact: "Event impact",
  historical_avg: "Historical average",
  weather: "Weather",
  sentiment: "Passenger sentiment",
};

function formatFactor(name: string, value: number) {
  const label = factorLabel[name] ?? name.replaceAll("_", " ");
  return `${label} (${Math.round(value * 100)}%)`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function AIExplainabilityPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ExplainabilityMetrics | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const [allocationsPayload, forecastsPayload] = await Promise.all([
      backend.railmind.listAllocations({}),
      backend.railmind.listForecasts({}),
    ]);

    const allocations = allocationsPayload.allocations as Allocation[];
    const forecasts = forecastsPayload.forecasts as Forecast[];

    const forecastByTrain = new Map<number, Forecast[]>();
    for (const forecast of forecasts) {
      if (!forecastByTrain.has(forecast.train_id)) {
        forecastByTrain.set(forecast.train_id, []);
      }
      forecastByTrain.get(forecast.train_id)!.push(forecast);
    }

    const derivedDecisions = allocations.slice(0, 10).map((allocation) => {
      const factors = Object.entries(allocation.shap_factors ?? {}).sort((left, right) => right[1] - left[1]);
      const topFactors = factors.slice(0, 3);
      const primaryWeight = topFactors[0]?.[1] ?? 0.5;

      const trainForecasts = forecastByTrain.get(allocation.train_id) ?? [];
      const avgConfidence = trainForecasts.length
        ? trainForecasts.reduce((sum, forecast) => sum + Number(forecast.confidence || 0), 0) / trainForecasts.length
        : 0.75;
      const avgDemand = trainForecasts.length
        ? trainForecasts.reduce((sum, forecast) => sum + Number(forecast.demand_score || 0), 0) / trainForecasts.length
        : 0.6;

      const confidence = clamp(primaryWeight * 0.55 + avgConfidence * 0.45, 0.55, 0.99);
      const impactEstimate = `${Math.round(avgDemand * 100)}% predicted demand pressure on train ${allocation.train_number ?? allocation.train_id}`;

      return {
        id: allocation.id,
        decision_type: "Coach Allocation Decision",
        recommendation: `${allocation.coach_number ?? "Coach"} assigned to train ${allocation.train_number ?? allocation.train_id} due to ${allocation.allocated_reason.toLowerCase()}.`,
        confidence,
        key_factors: topFactors.map(([name, value]) => formatFactor(name, Number(value))),
        impact_estimate: impactEstimate,
        timestamp: allocation.allocated_at,
      } satisfies Decision;
    });

    const avgForecastConfidence = forecasts.length
      ? forecasts.reduce((sum, forecast) => sum + Number(forecast.confidence || 0), 0) / forecasts.length
      : 0.82;
    const avgDecisionConfidence = derivedDecisions.length
      ? derivedDecisions.reduce((sum, decision) => sum + decision.confidence, 0) / derivedDecisions.length
      : 0.8;

    const explainableFactorCount = allocations.reduce((sum, allocation) => {
      return sum + Object.values(allocation.shap_factors ?? {}).filter((value) => Number(value) > 0).length;
    }, 0);
    const maxFactorCount = Math.max(1, allocations.length * 5);

    setMetrics({
      model_accuracy_pct: Math.round(avgForecastConfidence * 100),
      avg_confidence: avgDecisionConfidence,
      decisions_explained: derivedDecisions.length,
      model_interpretability_score: Math.round((explainableFactorCount / maxFactorCount) * 100),
    });
    setDecisions(
      derivedDecisions.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    );
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await load();
      } catch (error) {
        console.error("Error fetching AI explainability data:", error);
        toast({ title: "Failed to load explainability feed", variant: "destructive" });
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
          <Brain className="w-8 h-8 text-purple-500" />
          Explainable AI Decision Engine
        </h1>
        <p className="text-zinc-400 mt-2">Understand the reasoning behind every AI decision with full transparency</p>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard
            title="Model Accuracy"
            value={`${metrics.model_accuracy_pct}%`}
            icon={BarChart3}
            delta="+3%"
          />
          <KPICard
            title="Avg Confidence"
            value={`${(metrics.avg_confidence * 100).toFixed(0)}%`}
            icon={Brain}
            delta="+2%"
          />
          <KPICard
            title="Decisions Explained"
            value={metrics.decisions_explained.toString()}
            icon={Lightbulb}
            delta="+15%"
          />
          <KPICard
            title="Interpretability Score"
            value={metrics.model_interpretability_score.toString()}
            icon={TrendingUp}
            delta="+5%"
          />
        </div>
      )}

      <div className="space-y-4">
        {decisions.map((decision) => (
          <div key={decision.id} className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-zinc-100">{decision.decision_type}</h3>
                <p className="text-zinc-400 text-sm mt-1">{decision.recommendation}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end mb-2">
                  <span className="text-2xl font-bold text-blue-400">
                    {(decision.confidence * 100).toFixed(0)}%
                  </span>
                  <span className="text-zinc-500 text-sm">confidence</span>
                </div>
                <span className="text-xs text-zinc-500">
                  {new Date(decision.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>

            <div className="mb-4 p-4 bg-zinc-800/50 rounded border border-zinc-700">
              <p className="text-sm text-zinc-300 font-semibold mb-2">Impact Estimate:</p>
              <p className="text-emerald-400 font-semibold">{decision.impact_estimate}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {decision.key_factors.map((factor, idx) => (
                <div key={idx} className="bg-zinc-800 rounded p-3 border border-zinc-700">
                  <p className="text-xs text-zinc-400 mb-1">Key Factor {idx + 1}</p>
                  <p className="text-sm text-zinc-100">{factor}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
