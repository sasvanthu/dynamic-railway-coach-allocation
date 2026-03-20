import { useCallback, useEffect, useState } from "react";
import { Globe, Share2, TrendingUp, Zap } from "lucide-react";
import KPICard from "../components/KPICard";
import LoadingSpinner from "../components/LoadingSpinner";
import backend from "~backend/client";
import { useToast } from "@/components/ui/use-toast";

interface RakeSharingTransaction {
  id: number;
  from_zone: string;
  to_zone: string;
  rake_count: number;
  timestamp: string;
  savings_percentage: number;
  status: string;
}

interface RakeSharingMetrics {
  total_shared_rakes: number;
  active_zones: number;
  cost_savings_percent: number;
  efficiency_score: number;
}

interface RakeTransfer {
  id: number;
  from_zone: string;
  to_zone: string;
  coach_ids: number[];
  scheduled_at: string;
  status: string;
  estimated_savings_km: number;
}

const REFRESH_INTERVAL = Math.max(10_000, Number(import.meta.env.VITE_RAKE_SHARING_REFRESH_MS ?? 18_000));

function deriveSavingsPercent(estimatedSavingsKm: number) {
  return Math.max(8, Math.min(35, Math.round(estimatedSavingsKm / 45)));
}

function mapStatus(value: string) {
  if (value === "approved") return "in_transit";
  if (value === "proposed") return "pending";
  return "completed";
}

export default function RakeSharingNetworkPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<RakeSharingMetrics | null>(null);
  const [transactions, setTransactions] = useState<RakeSharingTransaction[]>([]);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const payload = await backend.railmind.listRakeTransfers();
    const transfers = payload.rake_transfers as RakeTransfer[];

    const mappedTransactions = transfers.map((transfer) => ({
      id: transfer.id,
      from_zone: transfer.from_zone,
      to_zone: transfer.to_zone,
      rake_count: Array.isArray(transfer.coach_ids) ? transfer.coach_ids.length : 0,
      timestamp: transfer.scheduled_at,
      savings_percentage: deriveSavingsPercent(Number(transfer.estimated_savings_km) || 0),
      status: mapStatus(transfer.status),
    }));

    const allZones = new Set<string>();
    mappedTransactions.forEach((transaction) => {
      allZones.add(transaction.from_zone);
      allZones.add(transaction.to_zone);
    });

    const avgSavings = mappedTransactions.length
      ? Math.round(mappedTransactions.reduce((sum, transaction) => sum + transaction.savings_percentage, 0) / mappedTransactions.length)
      : 0;

    const completedOrTransit = mappedTransactions.filter((transaction) => transaction.status !== "pending").length;
    const executionRate = mappedTransactions.length ? completedOrTransit / mappedTransactions.length : 0;

    setMetrics({
      total_shared_rakes: mappedTransactions.reduce((sum, transaction) => sum + transaction.rake_count, 0),
      active_zones: allZones.size,
      cost_savings_percent: avgSavings,
      efficiency_score: Math.round(Math.min(99, 70 + executionRate * 20 + avgSavings * 0.25)),
    });

    setTransactions(
      mappedTransactions.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    );
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await load();
      } catch (error) {
        console.error("Error fetching rake sharing data:", error);
        toast({ title: "Failed to load rake sharing network", variant: "destructive" });
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
          <Globe className="w-8 h-8 text-green-500" />
          Cross-Zonal Rake Sharing Network
        </h1>
        <p className="text-zinc-400 mt-2">Optimize rake utilization across zones using predictive analytics</p>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard
            title="Total Shared Rakes"
            value={metrics.total_shared_rakes.toString()}
            icon={Share2}
            delta="+12%"
          />
          <KPICard
            title="Active Zones"
            value={metrics.active_zones.toString()}
            icon={Globe}
            delta="+2%"
          />
          <KPICard
            title="Cost Savings"
            value={`${metrics.cost_savings_percent}%`}
            icon={TrendingUp}
            delta="+8%"
          />
          <KPICard
            title="Efficiency Score"
            value={metrics.efficiency_score.toString()}
            icon={Zap}
            delta="+5%"
          />
        </div>
      )}

      <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Share2 className="w-5 h-5 text-green-500" />
            Recent Rake Sharing Transactions
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-800/50">
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">From Zone</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">To Zone</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Rake Count</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Savings</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-300">Time</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-zinc-800 hover:bg-zinc-800/30 transition">
                  <td className="px-6 py-4 text-sm font-mono text-zinc-100">#{tx.id}</td>
                  <td className="px-6 py-4 text-sm text-zinc-300">{tx.from_zone}</td>
                  <td className="px-6 py-4 text-sm text-zinc-300">{tx.to_zone}</td>
                  <td className="px-6 py-4 text-sm text-zinc-100 font-semibold">{tx.rake_count}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="text-emerald-400 font-semibold">+{tx.savings_percentage}%</span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        tx.status === "completed"
                          ? "bg-emerald-900/40 text-emerald-400"
                          : "bg-blue-900/40 text-blue-400"
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">
                    {new Date(tx.timestamp).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
