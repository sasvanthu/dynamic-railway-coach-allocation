import { useEffect, useState } from "react";
import { Bell, Phone, AlertTriangle, TrendingUp, Zap } from "lucide-react";
import KPICard from "../components/KPICard";
import LoadingSpinner from "../components/LoadingSpinner";

interface SMSAlert {
  id: number;
  type: string;
  severity: string;
  message: string;
  recipients_count: number;
  delivery_status: string;
  sent_at: string;
  delivery_rate_percent: number;
}

interface AlertMetrics {
  total_alerts_today: number;
  delivery_rate: number;
  avg_response_time_minutes: number;
  customer_satisfaction_percent: number;
}

const generateAlerts = (): SMSAlert[] => {
  const types = ["Disruption Alert", "Seat Availability", "Coach Addition Alert", "Critical Alert", "Service Update"];
  const messages = [
    `Train delay notification - Please plan accordingly`,
    `Seat availability update for your route`,
    `Extra coaches added to improve your journey`,
    `Service disruption - Alternative routes available`,
    `Real-time status update available now`,
  ];
  const severities = ["normal", "high", "critical"];
  
  return Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    type: types[Math.floor(Math.random() * types.length)],
    severity: severities[Math.floor(Math.random() * severities.length)],
    message: messages[Math.floor(Math.random() * messages.length)],
    recipients_count: Math.floor(Math.random() * 10000) + 2000,
    delivery_status: Math.random() > 0.3 ? "delivered" : "in_delivery",
    sent_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    delivery_rate_percent: Math.floor(Math.random() * 8) + 92,
  }));
};

export default function AlertSystemPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AlertMetrics | null>(null);
  const [alerts, setAlerts] = useState<SMSAlert[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const alertData = generateAlerts();
        
        setMetrics({
          total_alerts_today: Math.floor(Math.random() * 100) + 80,
          delivery_rate: Math.floor(Math.random() * 3) + 96,
          avg_response_time_minutes: Math.floor(Math.random() * 3) + 2,
          customer_satisfaction_percent: Math.floor(Math.random() * 5) + 87,
        });

        setAlerts(alertData);
      } catch (error) {
        console.error("Error fetching alert data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 17000);
    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-900/40 text-red-400 border-red-700/50";
      case "high":
        return "bg-orange-900/40 text-orange-400 border-orange-700/50";
      default:
        return "bg-blue-900/40 text-blue-400 border-blue-700/50";
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Phone className="w-8 h-8 text-red-500" />
          Real-Time SMS Alert System
        </h1>
        <p className="text-zinc-400 mt-2">Proactive passenger notifications and service updates via SMS</p>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard
            title="Alerts Today"
            value={metrics.total_alerts_today.toString()}
            icon={Bell}
            trend={8}
          />
          <KPICard
            title="Delivery Rate"
            value={`${metrics.delivery_rate}%`}
            icon={Phone}
            trend={2}
          />
          <KPICard
            title="Avg Response Time"
            value={`${metrics.avg_response_time_minutes}min`}
            icon={Zap}
            trend={-3}
          />
          <KPICard
            title="Customer Satisfaction"
            value={`${metrics.customer_satisfaction_percent}%`}
            icon={TrendingUp}
            trend={5}
          />
        </div>
      )}

      <div className="space-y-4">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`rounded-lg border p-4 ${getSeverityColor(alert.severity)}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle
                    className={`w-5 h-5 ${
                      alert.severity === "critical"
                        ? "text-red-400"
                        : alert.severity === "high"
                        ? "text-orange-400"
                        : "text-blue-400"
                    }`}
                  />
                  <h3 className="text-lg font-semibold">{alert.type}</h3>
                  <span
                    className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                      alert.severity === "critical"
                        ? "bg-red-900/60 text-red-200"
                        : alert.severity === "high"
                        ? "bg-orange-900/60 text-orange-200"
                        : "bg-blue-900/60 text-blue-200"
                    }`}
                  >
                    {alert.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-zinc-200 mb-3">{alert.message}</p>
              </div>
              <div className="text-right ml-4">
                <p className="text-xs text-zinc-400 mb-1">Sent</p>
                <p className="text-sm font-mono text-zinc-300">
                  {new Date(alert.sent_at).toLocaleTimeString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-current border-opacity-20">
              <div>
                <p className="text-xs text-zinc-400 mb-1">Recipients</p>
                <p className="text-lg font-semibold">{alert.recipients_count.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-1">Delivery Rate</p>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-black/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-current"
                      style={{ width: `${alert.delivery_rate_percent}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold">{alert.delivery_rate_percent}%</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-1">Status</p>
                <p className="text-sm font-semibold capitalize">
                  {alert.delivery_status.replace("_", " ")}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
