import { useEffect, useState } from "react";
import { Users, MapPin, Clock, AlertCircle, Zap } from "lucide-react";
import KPICard from "../components/KPICard";
import LoadingSpinner from "../components/LoadingSpinner";

interface PassengerUpdate {
  id: number;
  train_number: string;
  current_station: string;
  next_station: string;
  estimated_arrival: string;
  occupancy_level: number;
  seats_available: number;
  delay_minutes: number;
  status: string;
}

interface PassengerMetrics {
  active_passengers: number;
  real_time_updates: number;
  satisfaction_score: number;
  on_time_performance_percent: number;
}

const stations = ["Central Station", "South Terminal", "North Junction", "East Platform", "West Gateway", "Mid Town Hub"];

const generatePassengerUpdates = (): PassengerUpdate[] => {
  return Array.from({ length: 6 }, (_, i) => {
    const currentIdx = Math.floor(Math.random() * (stations.length - 1));
    const nextIdx = currentIdx + 1;
    const delayMinutes = Math.random() > 0.7 ? Math.floor(Math.random() * 15) + 1 : 0;
    
    return {
      id: i + 1,
      train_number: `${12000 + Math.floor(Math.random() * 100)}`,
      current_station: stations[currentIdx],
      next_station: stations[nextIdx],
      estimated_arrival: new Date(Date.now() + (Math.random() * 3600000) + 600000).toISOString(),
      occupancy_level: Math.floor(Math.random() * 60) + 30,
      seats_available: Math.floor(Math.random() * 800) + 50,
      delay_minutes: delayMinutes,
      status: delayMinutes > 10 ? "major_delay" : delayMinutes > 0 ? "minor_delay" : "on_time",
    };
  });
};

export default function PassengerTransparencyPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<PassengerMetrics | null>(null);
  const [updates, setUpdates] = useState<PassengerUpdate[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const updateData = generatePassengerUpdates();
        
        setMetrics({
          active_passengers: Math.floor(Math.random() * 50000) + 30000,
          real_time_updates: Math.floor(Math.random() * 1000) + 800,
          satisfaction_score: (Math.random() * 1 + 7.5).toFixed(1) as any,
          on_time_performance_percent: Math.floor(Math.random() * 10) + 88,
        });

        setUpdates(updateData);
      } catch (error) {
        console.error("Error fetching passenger transparency data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 16000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "on_time":
        return "bg-emerald-900/40 text-emerald-400";
      case "minor_delay":
        return "bg-amber-900/40 text-amber-400";
      case "major_delay":
        return "bg-red-900/40 text-red-400";
      default:
        return "bg-zinc-800 text-zinc-400";
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-500" />
          Passenger Transparency App
        </h1>
        <p className="text-zinc-400 mt-2">Real-time journey updates and service transparency for passengers</p>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard
            title="Active Passengers"
            value={metrics.active_passengers.toLocaleString()}
            icon={Users}
            trend={8}
          />
          <KPICard
            title="Real-Time Updates"
            value={metrics.real_time_updates.toString()}
            icon={Zap}
            trend={12}
          />
          <KPICard
            title="Satisfaction Score"
            value={metrics.satisfaction_score.toString()}
            icon={AlertCircle}
            trend={2}
          />
          <KPICard
            title="On-Time Performance"
            value={`${metrics.on_time_performance_percent}%`}
            icon={Clock}
            trend={3}
          />
        </div>
      )}

      <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            Live Train Updates
          </h2>
        </div>
        <div className="space-y-3 p-6">
          {updates.map((update) => (
            <div key={update.id} className="bg-zinc-800/30 rounded-lg p-4 border border-zinc-700/50">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-zinc-100">Train {update.train_number}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadgeColor(update.status)}`}>
                      {update.status.replace("_", " ").toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-zinc-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      At: {update.current_station}
                    </span>
                    <span>→</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {update.next_station}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-500">ETA</p>
                  <p className="text-sm font-semibold text-zinc-100">
                    {new Date(update.estimated_arrival).toLocaleTimeString()}
                  </p>
                  {update.delay_minutes > 0 && (
                    <p className="text-xs text-red-400 mt-1">+{update.delay_minutes} min delay</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-3 border-t border-zinc-700/50">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Occupancy</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500"
                        style={{ width: `${update.occupancy_level}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-zinc-100">{update.occupancy_level}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Seats Available</p>
                  <p className="text-sm font-semibold text-emerald-400">{update.seats_available}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Status Info</p>
                  <p className="text-sm font-semibold text-zinc-100">Real-time</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
