import { useEffect, useRef, useState } from "react";
import backend from "~backend/client";
import LoadingSpinner from "../components/LoadingSpinner";
import { useToast } from "@/components/ui/use-toast";

interface Station {
  id: number;
  code: string;
  name: string;
  zone: string;
  lat: number;
  lng: number;
  platform_count: number;
  crowd_density: number | null;
  sentiment_score: number | null;
}

const zoneColors: Record<string, string> = {
  North: "border-blue-500/40 bg-blue-500/5",
  South: "border-emerald-500/40 bg-emerald-500/5",
  East: "border-amber-500/40 bg-amber-500/5",
  West: "border-purple-500/40 bg-purple-500/5",
  Central: "border-pink-500/40 bg-pink-500/5",
};

const zoneBadge: Record<string, string> = {
  North: "bg-blue-500/20 text-blue-300",
  South: "bg-emerald-500/20 text-emerald-300",
  East: "bg-amber-500/20 text-amber-300",
  West: "bg-purple-500/20 text-purple-300",
  Central: "bg-pink-500/20 text-pink-300",
};

function sentimentEmoji(score: number | null) {
  if (score == null) return "❓";
  if (score > 0.65) return "😊";
  if (score > 0.4) return "😐";
  return "😟";
}

function CrowdGauge({ density }: { density: number }) {
  const angle = -180 + density * 180;
  const r = 38;
  const cx = 50;
  const cy = 50;
  const rad = (angle * Math.PI) / 180;
  const nx = cx + r * Math.cos(rad);
  const ny = cy + r * Math.sin(rad);
  const color = density > 0.7 ? "#ef4444" : density > 0.4 ? "#f59e0b" : "#10b981";
  return (
    <svg viewBox="0 0 100 60" className="w-24 h-14">
      <path d="M12 50 A38 38 0 0 1 88 50" fill="none" stroke="#27272a" strokeWidth="8" strokeLinecap="round" />
      <path d="M12 50 A38 38 0 0 1 88 50" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${density * 119.4} 119.4`} />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e4e4e7" strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="3" fill="#e4e4e7" />
      <text x={cx} y={62} textAnchor="middle" fontSize="10" fill={color} fontWeight="600">{Math.round(density * 100)}%</text>
    </svg>
  );
}

export default function StationsPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    backend.railmind.listStations()
      .then((r) => setStations(r.stations))
      .catch((err) => { console.error(err); toast({ title: "Failed to load stations", variant: "destructive" }); })
      .finally(() => setLoading(false));
  }, []);

  const mapPositions = (stations: Station[]) => {
    if (stations.length === 0) return [];
    const lats = stations.map((s) => s.lat);
    const lngs = stations.map((s) => s.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return stations.map((s) => ({
      ...s,
      px: ((s.lng - minLng) / (maxLng - minLng || 1)) * 88 + 6,
      py: (1 - (s.lat - minLat) / (maxLat - minLat || 1)) * 85 + 5,
    }));
  };

  if (loading) return <LoadingSpinner />;

  const mapped = mapPositions(stations);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100">Station Network</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Real-time crowd density and sentiment monitoring</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 relative overflow-hidden" style={{ height: 280 }} ref={mapRef}>
        <h3 className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-3 absolute top-4 left-5 z-10">Geographic Network Map</h3>
        <svg className="absolute inset-0 w-full h-full">
          {mapped.slice(0, -1).map((a, i) => {
            const b = mapped[i + 1];
            return (
              <line
                key={i}
                x1={`${a.px}%`} y1={`${a.py}%`}
                x2={`${b.px}%`} y2={`${b.py}%`}
                stroke="#3f3f46" strokeWidth="1.5" strokeDasharray="4 4"
              />
            );
          })}
          {mapped.map((s) => (
            <g key={s.id}>
              <circle
                cx={`${s.px}%`} cy={`${s.py}%`}
                r={8 + (s.crowd_density ?? 0.5) * 10}
                fill={s.crowd_density && s.crowd_density > 0.7 ? "#ef444420" : "#10b98120"}
                stroke={s.crowd_density && s.crowd_density > 0.7 ? "#ef4444" : "#10b981"}
                strokeWidth="1.5"
              />
              <text x={`${s.px}%`} y={`${s.py - 4}%`} textAnchor="middle" fontSize="10" fontWeight="600" fill="#e4e4e7">{s.code}</text>
            </g>
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {stations.map((station) => (
          <div key={station.id} className={`bg-zinc-900 border ${zoneColors[station.zone] ?? "border-zinc-800"} rounded-xl p-4`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold text-zinc-100 font-mono">{station.code}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${zoneBadge[station.zone] ?? "bg-zinc-500/20 text-zinc-400"}`}>{station.zone}</span>
                </div>
                <p className="text-sm text-zinc-400">{station.name}</p>
              </div>
              <span className="text-2xl">{sentimentEmoji(station.sentiment_score)}</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-600 mb-1">Crowd Density</p>
                <CrowdGauge density={station.crowd_density ?? 0.5} />
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-600">Platforms</p>
                <p className="text-2xl font-bold text-zinc-300">{station.platform_count}</p>
                <p className="text-xs text-zinc-600 mt-1">Sentiment</p>
                <p className="text-sm font-semibold text-zinc-300">{station.sentiment_score != null ? `${Math.round(station.sentiment_score * 100)}%` : "N/A"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
