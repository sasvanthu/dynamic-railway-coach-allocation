import { useEffect, useState } from "react";
import { Globe, Share2, TrendingUp, Zap } from "lucide-react";
import KPICard from "../components/KPICard";
import LoadingSpinner from "../components/LoadingSpinner";

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

const generateRakeTransactions = (): RakeSharingTransaction[] => {
  const zones = ["North", "South", "East", "West", "Central"];
  const statuses = ["completed", "in_transit", "pending"];
  
  return Array.from({ length: 5 }, (_, i) => {
    const fromZone = zones[Math.floor(Math.random() * zones.length)];
    let toZone = zones[Math.floor(Math.random() * zones.length)];
    while (toZone === fromZone) toZone = zones[Math.floor(Math.random() * zones.length)];
    
    return {
      id: i + 1,
      from_zone: fromZone,
      to_zone: toZone,
      rake_count: Math.floor(Math.random() * 8) + 1,
      timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      savings_percentage: Math.floor(Math.random() * 15) + 10,
      status: statuses[Math.floor(Math.random() * statuses.length)],
    };
  });
};

export default function RakeSharingNetworkPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<RakeSharingMetrics | null>(null);
  const [transactions, setTransactions] = useState<RakeSharingTransaction[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setMetrics({
          total_shared_rakes: Math.floor(Math.random() * 250) + 100,
          active_zones: Math.floor(Math.random() * 4) + 5,
          cost_savings_percent: Math.floor(Math.random() * 15) + 15,
          efficiency_score: Math.floor(Math.random() * 15) + 80,
        });

        setTransactions(generateRakeTransactions());
      } catch (error) {
        console.error("Error fetching rake sharing data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 18000);
    return () => clearInterval(interval);
  }, []);

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
            trend={12}
          />
          <KPICard
            title="Active Zones"
            value={metrics.active_zones.toString()}
            icon={Globe}
            trend={2}
          />
          <KPICard
            title="Cost Savings"
            value={`${metrics.cost_savings_percent}%`}
            icon={TrendingUp}
            trend={8}
          />
          <KPICard
            title="Efficiency Score"
            value={metrics.efficiency_score.toString()}
            icon={Zap}
            trend={5}
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
