import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  delta?: string;
  icon: LucideIcon;
  color?: "blue" | "emerald" | "red" | "amber" | "purple";
  subtitle?: string;
}

const colorMap = {
  blue: { bg: "bg-blue-500/10", icon: "text-blue-400", border: "border-blue-500/20" },
  emerald: { bg: "bg-emerald-500/10", icon: "text-emerald-400", border: "border-emerald-500/20" },
  red: { bg: "bg-red-500/10", icon: "text-red-400", border: "border-red-500/20" },
  amber: { bg: "bg-amber-500/10", icon: "text-amber-400", border: "border-amber-500/20" },
  purple: { bg: "bg-purple-500/10", icon: "text-purple-400", border: "border-purple-500/20" },
};

export default function KPICard({ title, value, delta, icon: Icon, color = "blue", subtitle }: KPICardProps) {
  const colors = colorMap[color];
  return (
    <div className={`bg-zinc-900 border ${colors.border} rounded-xl p-5 flex items-start justify-between`}>
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">{title}</p>
        <p className="text-3xl font-bold text-zinc-100 mt-1">{value}</p>
        {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
        {delta && <p className="text-xs text-emerald-400 mt-1">{delta}</p>}
      </div>
      <div className={`w-10 h-10 ${colors.bg} rounded-lg flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${colors.icon}`} />
      </div>
    </div>
  );
}
