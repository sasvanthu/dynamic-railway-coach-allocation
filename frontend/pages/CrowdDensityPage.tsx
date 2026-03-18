import { useEffect, useState } from "react";
import { Camera, Zap, AlertTriangle, TrendingUp } from "lucide-react";
import KPICard from "../components/KPICard";
import LoadingSpinner from "../components/LoadingSpinner";

interface StationDensity {
  id: number;
  station_name: string;
  station_code: string;
  current_density: number;
  max_capacity: number;
  occupancy_percent: number;
  alert_level: string;
  detected_at: string;
}

interface CrowdMetrics {
  stations_monitored: number;
  high_density_stations: number;
  avg_occupancy_percent: number;
  detection_accuracy_percent: number;
}

export default function CrowdDensityPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<CrowdMetrics | null>(null);
  const [stations, setStations] = useState<StationDensity[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setMetrics({
          stations_monitored: 45,
          high_density_stations: 8,
          avg_occupancy_percent: 72,
          detection_accuracy_percent: 96,
        });

        setStations([
          {
            id: 1,
            station_name: "Central Station",
            station_code: "CST",
            current_density: 4250,
            max_capacity: 5000,
            occupancy_percent: 85,
            alert_level: "high",
            detected_at: new Date().toISOString(),
          },
          {
            id: 2,
            station_name: "South Terminal",
            station_code: "ST",
            current_density: 2150,
            max_capacity: 3500,
            occupancy_percent: 61,
            alert_level: "normal",
            detected_at: new Date().toISOString(),
          },
          {
            id: 3,
            station_name: "North Junction",
            station_code: "NJ",
            current_density: 4850,
            max_capacity: 5000,
            occupancy_percent: 97,
            alert_level: "critical",
            detected_at: new Date().toISOString(),
          },
          {
            id: 4,
            station_name: "East Platform",
            station_code: "EP",
            current_density: 1200,
            max_capacity: 2500,
            occupancy_percent: 48,
            alert_level: "normal",
            detected_at: new Date().toISOString(),
          },
        ]);
      } catch (error) {
        console.error("Error fetching crowd density data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const getAlertColor = (alertLevel: string) => {
    switch (alertLevel) {
      case "critical":
        return "bg-red-900/40 text-red-400";
      case "high":
        return "bg-orange-900/40 text-orange-400";
      case "normal":
        return "bg-emerald-900/40 text-emerald-400";
      default:
        return "bg-zinc-800 text-zinc-400";
    }
  };

  const getDensityBarColor = (percent: number) => {
    if (percent >= 90) return "bg-red-600";
    if (percent >= 75) return "bg-orange-500";
    if (percent >= 60) return "bg-amber-500";
    if (percent >= 40) return "bg-emerald-600";
    return "bg-blue-600";
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Camera className="w-8 h-8 text-cyan-500" />
          Edge AI Crowd Density Detection
        </h1>
        <p className="text-zinc-400 mt-2">Real-time crowd monitoring and density analysis powered by edge AI</p>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard
            title="Stations Monitored"
            value={metrics.stations_monitored.toString()}
            icon={Camera}
            trend={5}
          />
          <KPICard
            title="High Density Stations"
            value={metrics.high_density_stations.toString()}
            icon={AlertTriangle}
            trend={-2}
          />
          <KPICard
            title="Avg Occupancy"
            value={`${metrics.avg_occupancy_percent}%`}
            icon={TrendingUp}
            trend={3}
          />
          <KPICard
            title="Detection Accuracy"
            value={`${metrics.detection_accuracy_percent}%`}
            icon={Zap}
            trend={1}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stations.map((station) => (
          <div key={station.id} className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-zinc-100">{station.station_name}</h3>
                <p className="text-sm text-zinc-500 font-mono">{station.station_code}</p>
              </div>
              <span className={`px-3 py-1 rounded text-xs font-semibold ${getAlertColor(station.alert_level)}`}>
                {station.alert_level.toUpperCase()}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-zinc-400">Occupancy</span>
                  <span className="text-sm font-semibold text-zinc-100">{station.occupancy_percent}%</span>
                </div>
                <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${getDensityBarColor(station.occupancy_percent)}`}
                    style={{ width: `${station.occupancy_percent}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-zinc-800">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Current Density</p>
                  <p className="text-lg font-semibold text-zinc-100">{station.current_density}</p>
                  <p className="text-xs text-zinc-500">passengers</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Max Capacity</p>
                  <p className="text-lg font-semibold text-zinc-100">{station.max_capacity}</p>
                  <p className="text-xs text-zinc-500">passengers</p>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800">
                <p className="text-xs text-zinc-500">
                  Last detected: {new Date(station.detected_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
