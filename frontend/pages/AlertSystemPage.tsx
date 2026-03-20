import { useCallback, useEffect, useState } from "react";
import { Bell, Phone, AlertTriangle, TrendingUp, Zap } from "lucide-react";
import KPICard from "../components/KPICard";
import LoadingSpinner from "../components/LoadingSpinner";
import backend from "~backend/client";
import { useToast } from "@/components/ui/use-toast";

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

interface Disruption {
  id: number;
  type: string;
  severity: string;
  status: string;
  detected_at: string;
  train_number: string | null;
  train_name: string | null;
  cascade_impact?: {
    affected_trains?: number[];
    estimated_delay_min?: number;
  };
}

interface LiveStatus {
  train_id: number;
  train_number: string;
  train_name: string;
  status: string;
  delay_minutes: number;
  current_station_name?: string | null;
  fetched_at: string;
}

const REFRESH_INTERVAL = Math.max(10_000, Number(import.meta.env.VITE_ALERTS_REFRESH_MS ?? 17_000));

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

export default function AlertSystemPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AlertMetrics | null>(null);
  const [alerts, setAlerts] = useState<SMSAlert[]>([]);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const [disruptionsPayload, statusPayload] = await Promise.all([
      backend.railmind.listDisruptions(),
      backend.railmind.listLiveStatus({ refresh: true }),
    ]);

    const disruptions = disruptionsPayload.disruptions as Disruption[];
    const statuses = statusPayload.statuses as LiveStatus[];

    const disruptionAlerts = disruptions.map((disruption) => {
      const affected = disruption.cascade_impact?.affected_trains?.length ?? 1;
      const estimatedDelay = disruption.cascade_impact?.estimated_delay_min ?? 0;
      const deliveryRate = disruption.severity === "critical" ? 93 : disruption.severity === "high" ? 95 : 97;

      return {
        id: disruption.id,
        type: "Disruption Alert",
        severity: disruption.severity,
        message: `${disruption.train_number ?? "Train"} ${disruption.type.replaceAll("_", " ")} reported${estimatedDelay ? `, estimated ${estimatedDelay} min delay` : ""}.`,
        recipients_count: Math.round(2200 + affected * 1300 + estimatedDelay * 9),
        delivery_status: disruption.status === "active" ? "in_delivery" : "delivered",
        sent_at: disruption.detected_at,
        delivery_rate_percent: deliveryRate,
      } satisfies SMSAlert;
    });

    const liveStatusAlerts = statuses
      .filter((status) => status.status !== "on_time" || status.delay_minutes > 0)
      .slice(0, 8)
      .map((status) => ({
        id: 10_000 + status.train_id,
        type: "Service Update",
        severity: status.status === "cancelled" ? "critical" : status.delay_minutes > 20 ? "high" : "normal",
        message: `${status.train_number} ${status.train_name} is ${status.status.replaceAll("_", " ")}${status.current_station_name ? ` near ${status.current_station_name}` : ""}.`,
        recipients_count: Math.round(1800 + status.delay_minutes * 40),
        delivery_status: "delivered",
        sent_at: status.fetched_at,
        delivery_rate_percent: status.status === "cancelled" ? 94 : 98,
      }));

    const mergedAlerts = [...disruptionAlerts, ...liveStatusAlerts]
      .sort((left, right) => new Date(right.sent_at).getTime() - new Date(left.sent_at).getTime())
      .slice(0, 14);

    const avgDeliveryRate = mergedAlerts.length
      ? Math.round(mergedAlerts.reduce((sum, alert) => sum + alert.delivery_rate_percent, 0) / mergedAlerts.length)
      : 0;

    const inDelivery = mergedAlerts.filter((alert) => alert.delivery_status === "in_delivery");
    const avgResponseTime = inDelivery.length
      ? Math.max(
          1,
          Math.round(
            inDelivery.reduce((sum, alert) => {
              const sentAt = new Date(alert.sent_at).getTime();
              return sum + (Number.isFinite(sentAt) ? Math.max(1, (Date.now() - sentAt) / 60_000) : 1);
            }, 0) / inDelivery.length
          )
        )
      : 2;

    const onTimeShare = statuses.length
      ? statuses.filter((status) => status.status === "on_time").length / statuses.length
      : 0.8;

    setMetrics({
      total_alerts_today: mergedAlerts.filter((alert) => isToday(alert.sent_at)).length,
      delivery_rate: avgDeliveryRate,
      avg_response_time_minutes: avgResponseTime,
      customer_satisfaction_percent: Math.round(Math.min(99, avgDeliveryRate * 0.72 + onTimeShare * 26)),
    });
    setAlerts(mergedAlerts);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await load();
      } catch (error) {
        console.error("Error fetching alert data:", error);
        toast({ title: "Failed to load live alerts", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
    const interval = setInterval(() => void fetchData(), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [load, toast]);

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
            delta="+8%"
          />
          <KPICard
            title="Delivery Rate"
            value={`${metrics.delivery_rate}%`}
            icon={Phone}
            delta="+2%"
          />
          <KPICard
            title="Avg Response Time"
            value={`${metrics.avg_response_time_minutes}min`}
            icon={Zap}
            delta="-3%"
          />
          <KPICard
            title="Customer Satisfaction"
            value={`${metrics.customer_satisfaction_percent}%`}
            icon={TrendingUp}
            delta="+5%"
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
