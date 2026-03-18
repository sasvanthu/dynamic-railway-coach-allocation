import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, Zap, TrendingUp, Activity } from "lucide-react";
import KPICard from "../components/KPICard";
import LoadingSpinner from "../components/LoadingSpinner";

interface SimulationScenario {
  id: number;
  name: string;
  description: string;
  scenario_type: string;
  duration_hours: number;
  stations_affected: number;
  expected_impact: string;
  created_at: string;
  status: string;
}

interface SimulationMetrics {
  active_simulations: number;
  scenarios_created: number;
  total_simulation_hours: number;
  avg_accuracy_percent: number;
}

export default function SimulationPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setMetrics({
          active_simulations: 2,
          scenarios_created: 34,
          total_simulation_hours: 156,
          avg_accuracy_percent: 92,
        });

        setScenarios([
          {
            id: 1,
            name: "Rush Hour Peak Load Simulation",
            description: "Peak hour scenario with 45% above normal passenger demand",
            scenario_type: "demand_surge",
            duration_hours: 4,
            stations_affected: 12,
            expected_impact: "Test dynamic coach reallocation",
            created_at: new Date(Date.now() - 86400000).toISOString(),
            status: "completed",
          },
          {
            id: 2,
            name: "Zone-Wide Disruption Cascade",
            description: "Simulate disruption cascade across three zones",
            scenario_type: "cascade_disruption",
            duration_hours: 6,
            stations_affected: 18,
            expected_impact: "Evaluate disruption response capabilities",
            created_at: new Date(Date.now() - 172800000).toISOString(),
            status: "completed",
          },
          {
            id: 3,
            name: "Real-Time Coach Shortage",
            description: "Simulate limited coach availability and reallocation constraints",
            scenario_type: "resource_constraint",
            duration_hours: 3,
            stations_affected: 8,
            expected_impact: "Test rake sharing optimization",
            created_at: new Date(Date.now() - 259200000).toISOString(),
            status: "running",
          },
        ]);
      } catch (error) {
        console.error("Error fetching simulation data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getScenarioColor = (type: string) => {
    switch (type) {
      case "demand_surge":
        return "bg-orange-900/40 text-orange-400";
      case "cascade_disruption":
        return "bg-red-900/40 text-red-400";
      case "resource_constraint":
        return "bg-yellow-900/40 text-yellow-400";
      default:
        return "bg-blue-900/40 text-blue-400";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "bg-green-900/40 text-green-400 animate-pulse";
      case "completed":
        return "bg-emerald-900/40 text-emerald-400";
      case "paused":
        return "bg-amber-900/40 text-amber-400";
      default:
        return "bg-zinc-800 text-zinc-400";
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Zap className="w-8 h-8 text-purple-500" />
          Live Simulation & Demo Injector
        </h1>
        <p className="text-zinc-400 mt-2">Create and run realistic scenarios to test system capabilities</p>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard
            title="Active Simulations"
            value={metrics.active_simulations.toString()}
            icon={Activity}
            trend={1}
          />
          <KPICard
            title="Total Scenarios Created"
            value={metrics.scenarios_created.toString()}
            icon={Play}
            trend={5}
          />
          <KPICard
            title="Total Simulation Hours"
            value={metrics.total_simulation_hours.toString()}
            icon={TrendingUp}
            trend={12}
          />
          <KPICard
            title="Avg Accuracy"
            value={`${metrics.avg_accuracy_percent}%`}
            icon={Zap}
            trend={3}
          />
        </div>
      )}

      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Play className="w-5 h-5 text-purple-500" />
          Simulation Controls
        </h2>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition"
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4" />
                Pause Simulations
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Simulations
              </>
            )}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg font-medium transition">
            <RotateCcw className="w-4 h-4" />
            Reset All
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg font-medium transition">
            <Zap className="w-4 h-4" />
            Create New Scenario
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Simulation Scenarios</h2>
        {scenarios.map((scenario) => (
          <div key={scenario.id} className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-zinc-100">{scenario.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getScenarioColor(scenario.scenario_type)}`}>
                    {scenario.scenario_type.replace("_", " ").toUpperCase()}
                  </span>
                </div>
                <p className="text-zinc-400 mb-3">{scenario.description}</p>
              </div>
              <div className="text-right ml-4">
                <span className={`inline-block px-3 py-1 rounded text-xs font-semibold ${getStatusColor(scenario.status)}`}>
                  {scenario.status.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-zinc-800">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Duration</p>
                <p className="text-sm font-semibold text-zinc-100">{scenario.duration_hours} hours</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Stations Affected</p>
                <p className="text-sm font-semibold text-zinc-100">{scenario.stations_affected}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Expected Impact</p>
                <p className="text-sm font-semibold text-zinc-100">{scenario.expected_impact}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Created</p>
                <p className="text-sm font-semibold text-zinc-100">
                  {new Date(scenario.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition">
                View Results
              </button>
              <button className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm rounded transition">
                Clone Scenario
              </button>
              <button className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm rounded transition">
                Export Report
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
