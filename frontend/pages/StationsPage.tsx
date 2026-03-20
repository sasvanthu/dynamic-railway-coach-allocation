import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, LocateFixed, RefreshCcw, Signal } from "lucide-react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import backend from "~backend/client";
import LoadingSpinner from "../components/LoadingSpinner";
import { useToast } from "@/components/ui/use-toast";

type AlertLevel = "critical" | "high" | "medium" | "low";

interface LiveSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

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
  alert_level: AlertLevel;
  data_source: string;
  provider: string;
  status_message: string | null;
  last_updated: string | null;
  temperature_c: number | null;
  humidity_percent: number | null;
  weather_condition: string | null;
  distance_km?: number;
}

interface LiveStationsPayload {
  enabled: boolean;
  providers: string[];
  synced_external: number;
  total: number;
  last_sync: string | null;
  summary: LiveSummary;
  stations: unknown[];
}

interface NearbyStationsPayload {
  nearby: unknown[];
}

interface LocationState {
  status: "idle" | "locating" | "ready" | "unsupported" | "denied" | "error";
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  message: string;
}

interface LiveMeta {
  enabled: boolean;
  providers: string[];
  synced_external: number;
  total: number;
  last_sync: string | null;
  summary: LiveSummary;
}

const DEFAULT_CENTER: [number, number] = [22.5937, 78.9629];
const MAP_TILE_URL = import.meta.env.VITE_MAP_TILE_URL ?? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAP_TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_TILE_ATTRIBUTION ?? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const STATION_REFRESH_MS = Math.max(10_000, Number(import.meta.env.VITE_STATION_REFRESH_MS ?? 25_000));
const NEARBY_LIMIT = Math.min(10, Math.max(3, Number(import.meta.env.VITE_NEARBY_STATION_LIMIT ?? 5)));

const zoneColors: Record<string, string> = {
  North: "border-blue-500/40 bg-blue-500/5",
  South: "border-emerald-500/40 bg-emerald-500/5",
  East: "border-amber-500/40 bg-amber-500/5",
  West: "border-violet-500/40 bg-violet-500/5",
  Central: "border-pink-500/40 bg-pink-500/5",
};

const zoneBadge: Record<string, string> = {
  North: "bg-blue-500/20 text-blue-300",
  South: "bg-emerald-500/20 text-emerald-300",
  East: "bg-amber-500/20 text-amber-300",
  West: "bg-violet-500/20 text-violet-300",
  Central: "bg-pink-500/20 text-pink-300",
};

const alertBadge: Record<AlertLevel, string> = {
  critical: "bg-red-500/20 text-red-300",
  high: "bg-orange-500/20 text-orange-300",
  medium: "bg-amber-500/20 text-amber-300",
  low: "bg-emerald-500/20 text-emerald-300",
};

const alertColor: Record<AlertLevel, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#10b981",
};

const initialSummary: LiveSummary = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
};

const initialLiveMeta: LiveMeta = {
  enabled: false,
  providers: [],
  synced_external: 0,
  total: 0,
  last_sync: null,
  summary: initialSummary,
};

const initialLocationState: LocationState = {
  status: "idle",
  lat: null,
  lng: null,
  accuracyM: null,
  message: "Location access not requested yet",
};

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toNullableNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clamp01 = (value: number | null | undefined, fallback = 0.5) => {
  const normalized = value == null ? fallback : value;
  return Math.min(1, Math.max(0, normalized));
};

const normalizeStation = (raw: unknown): Station => {
  const station = (raw ?? {}) as Partial<Station> & Record<string, unknown>;
  return {
    id: toFiniteNumber(station.id),
    code: String(station.code ?? "N/A"),
    name: String(station.name ?? "Unknown Station"),
    zone: String(station.zone ?? "Central"),
    lat: toFiniteNumber(station.lat),
    lng: toFiniteNumber(station.lng),
    platform_count: toFiniteNumber(station.platform_count),
    crowd_density: toNullableNumber(station.crowd_density),
    sentiment_score: toNullableNumber(station.sentiment_score),
    alert_level: String(station.alert_level ?? "low") as AlertLevel,
    data_source: String(station.data_source ?? "internal-estimator"),
    provider: String(station.provider ?? "local-sensor-model"),
    status_message: station.status_message == null ? null : String(station.status_message),
    last_updated: station.last_updated == null ? null : String(station.last_updated),
    temperature_c: toNullableNumber(station.temperature_c),
    humidity_percent: toNullableNumber(station.humidity_percent),
    weather_condition: station.weather_condition == null ? null : String(station.weather_condition),
    distance_km: toNullableNumber(station.distance_km) ?? undefined,
  };
};

const summarizeStations = (stations: Station[]): LiveSummary => ({
  critical: stations.filter((station) => station.alert_level === "critical").length,
  high: stations.filter((station) => station.alert_level === "high").length,
  medium: stations.filter((station) => station.alert_level === "medium").length,
  low: stations.filter((station) => station.alert_level === "low").length,
});

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
      <path d="M12 50 A38 38 0 0 1 88 50" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${density * 119.4} 119.4`} />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e4e4e7" strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="3" fill="#e4e4e7" />
      <text x={cx} y={62} textAnchor="middle" fontSize="10" fill={color} fontWeight="600">{Math.round(density * 100)}%</text>
    </svg>
  );
}

function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(points, { padding: [20, 20], maxZoom: 9 });
  }, [map, points]);

  return null;
}

function formatRelativeTimestamp(value: string | null) {
  if (!value) return "No sync recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No sync recorded";

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.max(0, Math.round(diffMs / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  return `${Math.round(diffSec / 3600)}h ago`;
}

export default function StationsPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [nearbyStations, setNearbyStations] = useState<Station[]>([]);
  const [locationState, setLocationState] = useState<LocationState>(initialLocationState);
  const [liveMeta, setLiveMeta] = useState<LiveMeta>(initialLiveMeta);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const applyLivePayload = useCallback((payload: LiveStationsPayload) => {
    const normalizedStations = Array.isArray(payload.stations) ? payload.stations.map((station) => normalizeStation(station)) : [];
    setStations(normalizedStations);
    setLiveMeta({
      enabled: Boolean(payload.enabled),
      providers: Array.isArray(payload.providers) ? payload.providers : [],
      synced_external: toFiniteNumber(payload.synced_external),
      total: toFiniteNumber(payload.total, normalizedStations.length),
      last_sync: payload.last_sync ?? null,
      summary: payload.summary ?? summarizeStations(normalizedStations),
    });
  }, []);

  const loadStations = useCallback(
    async (refresh: boolean) => {
      const payload = (await backend.railmind.listLiveStations({ refresh })) as LiveStationsPayload;
      applyLivePayload(payload);
    },
    [applyLivePayload]
  );

  const loadNearbyStations = useCallback(async (lat: number, lng: number, refresh: boolean) => {
    const payload = (await backend.railmind.getNearbyStations({ lat, lng, limit: NEARBY_LIMIT, refresh })) as NearbyStationsPayload;
    const normalized = Array.isArray(payload.nearby) ? payload.nearby.map((station) => normalizeStation(station)) : [];
    setNearbyStations(normalized);
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationState({
        status: "unsupported",
        lat: null,
        lng: null,
        accuracyM: null,
        message: "Geolocation is unavailable in this browser.",
      });
      return;
    }

    setLocationState((previous) => ({
      ...previous,
      status: "locating",
      message: "Requesting location permission...",
    }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextState: LocationState = {
          status: "ready",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: Math.round(position.coords.accuracy),
          message: "Live location connected",
        };

        setLocationState(nextState);
        void loadNearbyStations(nextState.lat as number, nextState.lng as number, true).catch((error: unknown) => {
          console.error(error);
        });
      },
      (error) => {
        if (error.code === 1) {
          setLocationState({
            status: "denied",
            lat: null,
            lng: null,
            accuracyM: null,
            message: "Location access denied. Enable it to get nearest-station intelligence.",
          });
          return;
        }

        setLocationState({
          status: "error",
          lat: null,
          lng: null,
          accuracyM: null,
          message: "Unable to read location right now.",
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 90_000,
        timeout: 12_000,
      }
    );
  }, [loadNearbyStations]);

  const syncLiveStations = useCallback(async () => {
    try {
      setSyncing(true);
      const payload = (await backend.railmind.syncLiveStations()) as LiveStationsPayload;
      applyLivePayload(payload);

      if (locationState.status === "ready" && locationState.lat != null && locationState.lng != null) {
        await loadNearbyStations(locationState.lat, locationState.lng, false);
      }

      toast({
        title: "Live station sync complete",
        description: `${payload.synced_external ?? 0} stations refreshed from external providers.`,
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Station sync failed", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }, [applyLivePayload, loadNearbyStations, locationState.lat, locationState.lng, locationState.status, toast]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        await loadStations(true);
      } catch (error) {
        console.error(error);
        toast({ title: "Failed to load live stations", variant: "destructive" });
      } finally {
        if (active) setLoading(false);
      }

      requestLocation();
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, [loadStations, requestLocation, toast]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadStations(false).catch((error: unknown) => {
        console.error(error);
      });

      if (locationState.status === "ready" && locationState.lat != null && locationState.lng != null) {
        void loadNearbyStations(locationState.lat, locationState.lng, false).catch((error: unknown) => {
          console.error(error);
        });
      }
    }, STATION_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [loadNearbyStations, loadStations, locationState.lat, locationState.lng, locationState.status]);

  const nearbyById = useMemo(() => {
    const map = new Map<number, Station>();
    nearbyStations.forEach((station) => {
      map.set(station.id, station);
    });
    return map;
  }, [nearbyStations]);

  const sortedStations = useMemo(() => {
    return [...stations].sort((left, right) => {
      const leftDistance = nearbyById.get(left.id)?.distance_km;
      const rightDistance = nearbyById.get(right.id)?.distance_km;

      if (leftDistance != null && rightDistance != null) {
        return leftDistance - rightDistance;
      }
      if (leftDistance != null) return -1;
      if (rightDistance != null) return 1;
      return clamp01(right.crowd_density) - clamp01(left.crowd_density);
    });
  }, [nearbyById, stations]);

  const mapPoints = useMemo(() => {
    const points = stations.map((station) => [station.lat, station.lng] as [number, number]);
    if (locationState.status === "ready" && locationState.lat != null && locationState.lng != null) {
      points.push([locationState.lat, locationState.lng]);
    }
    return points;
  }, [locationState.lat, locationState.lng, locationState.status, stations]);

  const nearestStation = nearbyStations[0] ?? null;
  const summary = liveMeta.summary ?? summarizeStations(stations);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Live Station Intelligence</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Location-aware station monitoring with live crowd, weather, and sentiment telemetry</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void requestLocation()}
            className="px-3 py-2 text-sm rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 transition"
          >
            <span className="inline-flex items-center gap-1.5"><LocateFixed className="w-4 h-4" />Use My Location</span>
          </button>
          <button
            type="button"
            onClick={() => void syncLiveStations()}
            disabled={syncing}
            className="px-3 py-2 text-sm rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-1.5"><RefreshCcw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />Sync Live Feed</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <p className="text-xs text-red-300/70">Critical Alerts</p>
          <p className="text-2xl font-bold text-red-300">{summary.critical}</p>
        </div>
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
          <p className="text-xs text-orange-300/70">High Alerts</p>
          <p className="text-2xl font-bold text-orange-300">{summary.high}</p>
        </div>
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-3">
          <p className="text-xs text-zinc-500">External Refresh</p>
          <p className="text-2xl font-bold text-zinc-200">{liveMeta.synced_external}/{Math.max(1, liveMeta.total)}</p>
        </div>
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-3">
          <p className="text-xs text-zinc-500">Last Sync</p>
          <p className="text-sm font-semibold text-zinc-200 mt-1">{formatRelativeTimestamp(liveMeta.last_sync)}</p>
          <p className="text-xs text-zinc-500 mt-1">Auto refresh: {Math.round(STATION_REFRESH_MS / 1000)}s</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden" style={{ height: 360 }}>
        <MapContainer center={DEFAULT_CENTER} zoom={5} scrollWheelZoom className="h-full w-full" zoomControl>
          <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} />
          <FitBounds points={mapPoints} />

          {locationState.status === "ready" && locationState.lat != null && locationState.lng != null &&
            nearbyStations.map((station) => (
              <Polyline
                key={`link-${station.id}`}
                positions={[[locationState.lat as number, locationState.lng as number], [station.lat, station.lng]]}
                pathOptions={{ color: "#38bdf8", weight: 1.5, opacity: 0.35, dashArray: "6 6" }}
              />
            ))}

          {stations.map((station) => {
            const density = clamp01(station.crowd_density);
            const highlighted = nearbyById.has(station.id);
            const color = alertColor[station.alert_level] ?? "#10b981";
            return (
              <CircleMarker
                key={station.id}
                center={[station.lat, station.lng]}
                radius={6 + density * 8 + (highlighted ? 2 : 0)}
                pathOptions={{ color, fillColor: color, fillOpacity: highlighted ? 0.6 : 0.35, weight: highlighted ? 3 : 2 }}
              >
                <Tooltip direction="top">{station.code}</Tooltip>
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">{station.name}</p>
                    <p className="text-xs text-zinc-600">Zone: {station.zone}</p>
                    <p className="text-xs text-zinc-600">Alert: {station.alert_level.toUpperCase()}</p>
                    <p className="text-xs text-zinc-600">Crowd density: {Math.round(density * 100)}%</p>
                    {station.distance_km != null && <p className="text-xs text-zinc-600">Distance: {station.distance_km.toFixed(1)} km</p>}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {locationState.status === "ready" && locationState.lat != null && locationState.lng != null && (
            <CircleMarker
              center={[locationState.lat, locationState.lng]}
              radius={10}
              pathOptions={{ color: "#38bdf8", fillColor: "#38bdf8", fillOpacity: 0.45, weight: 3 }}
            >
              <Tooltip direction="top">You are here</Tooltip>
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold text-sky-700">Citizen Location</p>
                  <p className="text-xs text-zinc-600">Accuracy: {locationState.accuracyM ?? "N/A"} m</p>
                </div>
              </Popup>
            </CircleMarker>
          )}
        </MapContainer>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-zinc-300"><Signal className="w-4 h-4 text-emerald-400" />Providers: {liveMeta.providers.join(", ") || "internal-estimator"}</span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400">Location status: {locationState.message}</span>
          {nearestStation && (
            <>
              <span className="text-zinc-600">|</span>
              <span className="inline-flex items-center gap-1.5 text-sky-300"><LocateFixed className="w-4 h-4" />Nearest: {nearestStation.code} ({nearestStation.distance_km?.toFixed(1)} km)</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sortedStations.map((station) => {
          const crowdDensity = clamp01(station.crowd_density);
          const distance = nearbyById.get(station.id)?.distance_km;

          return (
            <div key={station.id} className={`bg-zinc-900 border ${zoneColors[station.zone] ?? "border-zinc-800"} rounded-xl p-4`}>
              <div className="flex items-start justify-between mb-3 gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-lg font-bold text-zinc-100 font-mono">{station.code}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${zoneBadge[station.zone] ?? "bg-zinc-500/20 text-zinc-400"}`}>{station.zone}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${alertBadge[station.alert_level]}`}>{station.alert_level.toUpperCase()}</span>
                  </div>
                  <p className="text-sm text-zinc-400">{station.name}</p>
                  {distance != null && <p className="text-xs text-sky-300 mt-1">{distance.toFixed(1)} km from your location</p>}
                </div>
                <span className="text-2xl">{sentimentEmoji(station.sentiment_score)}</span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-zinc-600 mb-1">Crowd Density</p>
                  <CrowdGauge density={crowdDensity} />
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-600">Platforms</p>
                  <p className="text-2xl font-bold text-zinc-300">{station.platform_count}</p>
                  <p className="text-xs text-zinc-600 mt-1">Sentiment</p>
                  <p className="text-sm font-semibold text-zinc-300">{station.sentiment_score != null ? `${Math.round(station.sentiment_score * 100)}%` : "N/A"}</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-1.5">
                {station.status_message && (
                  <p className="text-xs text-zinc-300 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-400" />
                    <span>{station.status_message}</span>
                  </p>
                )}
                <p className="text-xs text-zinc-500">Provider: <span className="text-zinc-300">{station.provider}</span></p>
                <p className="text-xs text-zinc-500">Weather: <span className="text-zinc-300">{station.weather_condition ?? "N/A"}</span></p>
                <p className="text-xs text-zinc-500">Temp/Humidity: <span className="text-zinc-300">{station.temperature_c != null ? `${station.temperature_c.toFixed(1)}°C` : "N/A"} / {station.humidity_percent != null ? `${Math.round(station.humidity_percent)}%` : "N/A"}</span></p>
                <p className="text-xs text-zinc-500">Updated: <span className="text-zinc-300">{formatRelativeTimestamp(station.last_updated)}</span></p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
