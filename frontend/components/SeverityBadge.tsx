interface SeverityBadgeProps {
  severity: string;
  className?: string;
}

const severityConfig: Record<string, { label: string; classes: string }> = {
  critical: { label: "Critical", classes: "bg-red-500/20 text-red-400 border border-red-500/30" },
  high: { label: "High", classes: "bg-orange-500/20 text-orange-400 border border-orange-500/30" },
  medium: { label: "Medium", classes: "bg-amber-500/20 text-amber-400 border border-amber-500/30" },
  low: { label: "Low", classes: "bg-blue-500/20 text-blue-400 border border-blue-500/30" },
  active: { label: "Active", classes: "bg-red-500/20 text-red-400 border border-red-500/30" },
  resolved: { label: "Resolved", classes: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" },
  on_time: { label: "On Time", classes: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" },
  delayed: { label: "Delayed", classes: "bg-amber-500/20 text-amber-400 border border-amber-500/30" },
  cancelled: { label: "Cancelled", classes: "bg-red-500/20 text-red-400 border border-red-500/30" },
  proposed: { label: "Proposed", classes: "bg-blue-500/20 text-blue-400 border border-blue-500/30" },
  approved: { label: "Approved", classes: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" },
  in_transit: { label: "In Transit", classes: "bg-purple-500/20 text-purple-400 border border-purple-500/30" },
  completed: { label: "Completed", classes: "bg-zinc-500/20 text-zinc-400 border border-zinc-500/30" },
};

export default function SeverityBadge({ severity, className = "" }: SeverityBadgeProps) {
  const config = severityConfig[severity] ?? { label: severity, classes: "bg-zinc-500/20 text-zinc-400 border border-zinc-500/30" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.classes} ${className}`}>
      {config.label}
    </span>
  );
}
