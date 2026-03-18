import { NavLink } from "react-router-dom";
import { Train, MapPin, AlertTriangle, TrendingUp, Network, MessageSquare, LayoutDashboard, Zap, Clock, Globe, Brain, Camera, Users, Phone, Gamepad2 } from "lucide-react";
import { useEffect, useState } from "react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/trains", icon: Train, label: "Trains" },
  { to: "/stations", icon: MapPin, label: "Stations" },
  { to: "/disruptions", icon: AlertTriangle, label: "Disruptions" },
  { to: "/forecasts", icon: TrendingUp, label: "Forecasts" },
  { to: "/rake-transfers", icon: Network, label: "Rake Transfers" },
  { to: "/sentiment", icon: MessageSquare, label: "Sentiment" },
  { to: "/coach-reallocation", icon: Clock, label: "Coach Reallocation" },
  { to: "/cascade-disruptions", icon: Network, label: "Cascade Engine" },
  { to: "/rake-sharing", icon: Globe, label: "Rake Sharing" },
  { to: "/ai-explainability", icon: Brain, label: "AI Explainability" },
  { to: "/crowd-density", icon: Camera, label: "Crowd Density" },
  { to: "/passenger-transparency", icon: Users, label: "Passenger App" },
  { to: "/alerts", icon: Phone, label: "SMS Alerts" },
  { to: "/simulation", icon: Gamepad2, label: "Simulation" },
];

export default function Sidebar() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full shrink-0">
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Train className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-100 tracking-tight">RailMind</h1>
            <p className="text-xs text-zinc-500">Intelligence DSS</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-xs text-zinc-400 font-mono">{time.toLocaleTimeString()}</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              }`
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 rounded-lg">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-zinc-400">AI Engine: Active</span>
        </div>
      </div>
    </div>
  );
}
