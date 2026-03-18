import { useEffect, useState } from "react";
import { Brain, BarChart3, Lightbulb, TrendingUp } from "lucide-react";
import KPICard from "../components/KPICard";
import LoadingSpinner from "../components/LoadingSpinner";

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

export default function AIExplainabilityPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ExplainabilityMetrics | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setMetrics({
          model_accuracy_pct: 94,
          avg_confidence: 0.88,
          decisions_explained: 2341,
          model_interpretability_score: 92,
        });

        setDecisions([
          {
            id: 1,
            decision_type: "Coach Reallocation",
            recommendation: "Move 2 coaches from Train 12051 to Train 12052",
            confidence: 0.96,
            key_factors: ["Demand surge (92%)", "Capacity analysis (88%)", "Zone coverage (85%)"],
            impact_estimate: "18% capacity improvement",
            timestamp: new Date(Date.now() - 600000).toISOString(),
          },
          {
            id: 2,
            decision_type: "Disruption Prediction",
            recommendation: "High probability of cascade in Zone-B detected",
            confidence: 0.91,
            key_factors: ["Weather patterns (89%)", "Historical data (87%)", "Current load (84%)"],
            impact_estimate: "Prevent 7-train cascade",
            timestamp: new Date(Date.now() - 1200000).toISOString(),
          },
          {
            id: 3,
            decision_type: "Rake Sharing",
            recommendation: "Share 3 rakes from North to South zone",
            confidence: 0.85,
            key_factors: ["Demand forecast (90%)", "Cost optimization (82%)", "Zone distance (79%)"],
            impact_estimate: "23% cost reduction",
            timestamp: new Date(Date.now() - 1800000).toISOString(),
          },
        ]);
      } catch (error) {
        console.error("Error fetching AI explainability data:", error);
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
            trend={3}
          />
          <KPICard
            title="Avg Confidence"
            value={`${(metrics.avg_confidence * 100).toFixed(0)}%`}
            icon={Brain}
            trend={2}
          />
          <KPICard
            title="Decisions Explained"
            value={metrics.decisions_explained.toString()}
            icon={Lightbulb}
            trend={15}
          />
          <KPICard
            title="Interpretability Score"
            value={metrics.model_interpretability_score.toString()}
            icon={TrendingUp}
            trend={5}
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
