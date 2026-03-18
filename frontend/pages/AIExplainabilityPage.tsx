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

const generateDecisions = (): Decision[] => {
  const types = ["Coach Reallocation", "Disruption Prediction", "Rake Sharing", "Demand Forecast", "Capacity Planning"];
  const impacts = [
    "18% capacity improvement",
    "Prevent 7-train cascade",
    "23% cost reduction",
    "52 more passengers accommodated",
    "31% utilization increase",
  ];
  
  return Array.from({ length: 4 }, (_, i) => ({
    id: i + 1,
    decision_type: types[Math.floor(Math.random() * types.length)],
    recommendation: `Recommendation ${i + 1}: ${Math.random() > 0.5 ? "Increase" : "Decrease"} allocation by ${Math.floor(Math.random() * 30) + 5} units`,
    confidence: 0.80 + Math.random() * 0.20,
    key_factors: [
      `Primary factor (${Math.floor(Math.random() * 10) + 80}%)`,
      `Secondary factor (${Math.floor(Math.random() * 10) + 75}%)`,
      `Tertiary factor (${Math.floor(Math.random() * 10) + 70}%)`,
    ],
    impact_estimate: impacts[Math.floor(Math.random() * impacts.length)],
    timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
  }));
};

export default function AIExplainabilityPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ExplainabilityMetrics | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setMetrics({
          model_accuracy_pct: Math.floor(Math.random() * 8) + 90,
          avg_confidence: 0.82 + Math.random() * 0.15,
          decisions_explained: Math.floor(Math.random() * 1000) + 1500,
          model_interpretability_score: Math.floor(Math.random() * 8) + 88,
        });

        setDecisions(generateDecisions());
      } catch (error) {
        console.error("Error fetching AI explainability data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 20000);
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
