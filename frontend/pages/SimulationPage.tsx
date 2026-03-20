import { useCallback, useEffect, useState } from "react";
import { Play, Pause, RotateCcw, Zap, TrendingUp, Activity } from "lucide-react";
import KPICard from "../components/KPICard";
import LoadingSpinner from "../components/LoadingSpinner";
import backend from "~backend/client";
import { useToast } from "@/components/ui/use-toast";

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

interface LiveEvent {
  id: number;
  name: string;
  type: string;
  start_date: string;
  end_date: string;
  expected_attendance: number;
}

interface LiveDisruption {
  id: number;
  severity: string;
  status: string;
  detected_at: string;
  cascade_impact?: {
    affected_trains?: number[];
    estimated_delay_min?: number;
  };
}

interface RakeTransfer {
  id: number;
  from_zone: string;
  to_zone: string;
  coach_ids: number[];
  scheduled_at: string;
  status: string;
}

interface Forecast {
  confidence: number;
}

const REFRESH_INTERVAL = Math.max(10_000, Number(import.meta.env.VITE_SIMULATION_REFRESH_MS ?? 19_000));

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function SimulationPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const [eventsPayload, disruptionsPayload, forecastsPayload, transfersPayload] = await Promise.all([
      backend.railmind.listEvents(),
      backend.railmind.listDisruptions(),
      backend.railmind.listForecasts({}),
      backend.railmind.listRakeTransfers(),
    ]);

    const events = eventsPayload.events as LiveEvent[];
    const disruptions = disruptionsPayload.disruptions as LiveDisruption[];
    const forecasts = forecastsPayload.forecasts as Forecast[];
    const transfers = transfersPayload.rake_transfers as RakeTransfer[];

    const now = Date.now();

    const eventScenarios: SimulationScenario[] = events.map((event) => {
      const start = new Date(event.start_date).getTime();
      const end = new Date(event.end_date).getTime();
      const durationHours = Math.max(1, Math.round(Math.max(1, end - start) / 3_600_000));

      let status = "paused";
      if (now < start) status = "paused";
      else if (now >= start && now <= end) status = "running";
      else status = "completed";

      return {
        id: event.id,
        name: `${event.name} Scenario`,
        description: `Event load simulation for ${event.name}`,
        scenario_type: "demand_surge",
        duration_hours: durationHours,
        stations_affected: clamp(Math.round(event.expected_attendance / 300000), 3, 25),
        expected_impact: `${Math.round(event.expected_attendance / 1000)}K passengers pressure`,
        created_at: event.start_date,
        status,
      };
    });

    const disruptionScenarios: SimulationScenario[] = disruptions.map((disruption) => ({
      id: 10_000 + disruption.id,
      name: `Disruption ${disruption.id} Cascade`,
      description: `Operational stress simulation for ${disruption.severity} disruption`,
      scenario_type: "cascade_disruption",
      duration_hours: clamp(Math.round((disruption.cascade_impact?.estimated_delay_min ?? 90) / 30), 2, 10),
      stations_affected: clamp(disruption.cascade_impact?.affected_trains?.length ?? 2, 2, 15),
      expected_impact: `${disruption.cascade_impact?.estimated_delay_min ?? 0} min schedule shift`,
      created_at: disruption.detected_at,
      status: disruption.status === "active" ? "running" : "completed",
    }));

    const transferScenarios: SimulationScenario[] = transfers.slice(0, 6).map((transfer) => ({
      id: 20_000 + transfer.id,
      name: `Rake Shift ${transfer.from_zone} to ${transfer.to_zone}`,
      description: `Resource rebalancing what-if for ${transfer.from_zone} and ${transfer.to_zone}`,
      scenario_type: "resource_constraint",
      duration_hours: 4,
      stations_affected: clamp((transfer.coach_ids?.length ?? 1) * 2, 2, 12),
      expected_impact: `${transfer.coach_ids?.length ?? 0} coaches moved`,
      created_at: transfer.scheduled_at,
      status: transfer.status === "approved" ? "running" : "paused",
    }));

    const scenarioData = [...eventScenarios, ...disruptionScenarios, ...transferScenarios]
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .slice(0, 14);

    const runningCount = scenarioData.filter((scenario) => scenario.status === "running").length;
    const totalHours = scenarioData.reduce((sum, scenario) => sum + scenario.duration_hours, 0);
    const avgForecastConfidence = forecasts.length
      ? forecasts.reduce((sum, forecast) => sum + Number(forecast.confidence || 0), 0) / forecasts.length
      : 0.88;

    setMetrics({
      active_simulations: runningCount,
      scenarios_created: scenarioData.length,
      total_simulation_hours: totalHours,
      avg_accuracy_percent: Math.round(avgForecastConfidence * 100),
    });
    setScenarios(scenarioData);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await load();
      } catch (error) {
        console.error("Error fetching simulation data:", error);
        toast({ title: "Failed to load live simulation scenarios", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
    const interval = setInterval(() => void fetchData(), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [load, toast]);

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
            delta="+1%"
          />
          <KPICard
            title="Total Scenarios Created"
            value={metrics.scenarios_created.toString()}
            icon={Play}
            delta="+5%"
          />
          <KPICard
            title="Total Simulation Hours"
            value={metrics.total_simulation_hours.toString()}
            icon={TrendingUp}
            delta="+12%"
          />
          <KPICard
            title="Avg Accuracy"
            value={`${metrics.avg_accuracy_percent}%`}
            icon={Zap}
            delta="+3%"
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
