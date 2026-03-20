import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPinned, Radio, RefreshCw, Train } from "lucide-react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import backend from "~backend/client";

interface LiveSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

type AlertLevel = "critical" | "high" | "medium" | "low";

interface LiveStation {
  id: number;
  code: string;
  name: string;
  zone: string;
  lat: number;
  lng: number;
  crowd_density: number | null;
  alert_level: AlertLevel;
  provider: string;
  last_updated: string | null;
}

interface LiveStatus {
  train_id: number;
  train_number: string;
  train_name: string;
  status: string;
  delay_minutes: number | null;
  current_station_code?: string | null;
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

interface LiveStatusPayload {
  providers: string[];
  statuses: unknown[];
  summary: { on_time: number; delayed: number; cancelled: number };
  last_sync: string | null;
}

const DEFAULT_CENTER: [number, number] = [22.5937, 78.9629];
const REFRESH_MS = Math.max(10_000, Number(import.meta.env.VITE_GLOBAL_MAP_REFRESH_MS ?? 20_000));
const MAP_TILE_URL = import.meta.env.VITE_MAP_TILE_URL ?? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAP_TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_TILE_ATTRIBUTION ?? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const alertColor: Record<AlertLevel, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#10b981",
};

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampDensity(value: number | null | undefined): number {
  const normalized = value ?? 0.45;
  return Math.min(1, Math.max(0, normalized));
}

function normalizeStation(raw: unknown): LiveStation {
  const station = (raw ?? {}) as Partial<LiveStation> & Record<string, unknown>;
  return {
    id: toFiniteNumber(station.id),
    code: String(station.code ?? "N/A"),
    name: String(station.name ?? "Unknown"),
    zone: String(station.zone ?? "Central"),
    lat: toFiniteNumber(station.lat),
    lng: toFiniteNumber(station.lng),
    crowd_density: toNullableNumber(station.crowd_density),
    alert_level: String(station.alert_level ?? "low") as AlertLevel,
    provider: String(station.provider ?? "internal-estimator"),
    last_updated: station.last_updated == null ? null : String(station.last_updated),
  };
}

function normalizeStatus(raw: unknown): LiveStatus {
  const status = (raw ?? {}) as Partial<LiveStatus> & Record<string, unknown>;
  return {
    train_id: toFiniteNumber(status.train_id),
    train_number: String(status.train_number ?? "N/A"),
    train_name: String(status.train_name ?? "Unknown Train"),
    status: String(status.status ?? "on_time"),
    delay_minutes: toNullableNumber(status.delay_minutes),
    current_station_code: status.current_station_code == null ? null : String(status.current_station_code),
  };
}

function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(points, { padding: [24, 24], maxZoom: 7 });
  }, [map, points]);

  return null;
}

export default function GlobalLiveRailMap() {
  const [stations, setStations] = useState<LiveStation[]>([]);
  const [statuses, setStatuses] = useState<LiveStatus[]>([]);
  const [stationMeta, setStationMeta] = useState<{ providers: string[]; synced: number; total: number; summary: LiveSummary }>({
    providers: [],
    synced: 0,
    total: 0,
    summary: { critical: 0, high: 0, medium: 0, low: 0 },
  });
  const [statusMeta, setStatusMeta] = useState<{ providers: string[]; summary: { on_time: number; delayed: number; cancelled: number } }>({
    providers: [],
    summary: { on_time: 0, delayed: 0, cancelled: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async (refresh: boolean) => {
    const [stationPayload, statusPayload] = await Promise.all([
      backend.railmind.listLiveStations({ refresh }) as Promise<LiveStationsPayload>,
      backend.railmind.listLiveStatus({ refresh }) as Promise<LiveStatusPayload>,
    ]);

    const normalizedStations = Array.isArray(stationPayload.stations)
      ? stationPayload.stations.map((station) => normalizeStation(station))
      : [];

    const normalizedStatuses = Array.isArray(statusPayload.statuses)
      ? statusPayload.statuses.map((status) => normalizeStatus(status))
      : [];

    setStations(normalizedStations);
    setStatuses(normalizedStatuses);
    setStationMeta({
      providers: Array.isArray(stationPayload.providers) ? stationPayload.providers : [],
      synced: toFiniteNumber(stationPayload.synced_external),
      total: toFiniteNumber(stationPayload.total, normalizedStations.length),
      summary: stationPayload.summary ?? { critical: 0, high: 0, medium: 0, low: 0 },
    });
    setStatusMeta({
      providers: Array.isArray(statusPayload.providers) ? statusPayload.providers : [],
      summary: statusPayload.summary ?? { on_time: 0, delayed: 0, cancelled: 0 },
    });
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        await load(true);
      } catch (error) {
        console.error("Failed to load global rail map", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void bootstrap();

    const interval = window.setInterval(() => {
      void load(false).catch((error) => {
        console.error("Global rail map refresh failed", error);
      });
    }, REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [load]);

  const syncAll = async () => {
    try {
      setSyncing(true);
      await Promise.all([backend.railmind.syncLiveStations(), backend.railmind.syncLiveStatus()]);
      await load(true);
    } catch (error) {
      console.error("Failed to sync global rail map", error);
    } finally {
      setSyncing(false);
    }
  };

  const stationTrainCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const status of statuses) {
      if (!status.current_station_code) continue;
      counts.set(status.current_station_code, (counts.get(status.current_station_code) ?? 0) + 1);
    }
    return counts;
  }, [statuses]);

  const mapPoints = useMemo(() => stations.map((station) => [station.lat, station.lng] as [number, number]), [stations]);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/90 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <MapPinned className="w-4 h-4 text-cyan-400" />
            Live National Rail Map
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {stationMeta.synced}/{Math.max(1, stationMeta.total)} stations with external telemetry | {statusMeta.summary.on_time} on-time, {statusMeta.summary.delayed} delayed, {statusMeta.summary.cancelled} cancelled
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 inline-flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            Stations: {stationMeta.providers.join(", ") || "internal-estimator"}
          </span>
          <button
            type="button"
            onClick={() => void syncAll()}
            disabled={syncing}
            className="px-3 py-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition text-xs disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />Sync</span>
          </button>
        </div>
      </div>

      <div style={{ height: 280 }}>
        {!loading && stations.length > 0 ? (
          <MapContainer center={DEFAULT_CENTER} zoom={5} scrollWheelZoom className="h-full w-full" zoomControl>
            <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} />
            <FitBounds points={mapPoints} />

            {stations.map((station) => {
              const density = clampDensity(station.crowd_density);
              const color = alertColor[station.alert_level] ?? "#10b981";
              const activeTrains = stationTrainCount.get(station.code) ?? 0;

              return (
                <CircleMarker
                  key={station.id}
                  center={[station.lat, station.lng]}
                  radius={6 + density * 8}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0.45,
                    weight: 2,
                  }}
                >
                  <Tooltip direction="top">{station.code}</Tooltip>
                  <Popup>
                    <div className="text-sm min-w-40">
                      <p className="font-semibold">{station.name}</p>
                      <p className="text-xs text-zinc-600">Zone: {station.zone}</p>
                      <p className="text-xs text-zinc-600">Crowd density: {Math.round(density * 100)}%</p>
                      <p className="text-xs text-zinc-600">Active trains nearby: {activeTrains}</p>
                      <p className="text-xs text-zinc-600">Provider: {station.provider}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-sm text-zinc-500 gap-2">
            <Train className="w-4 h-4" />
            Loading live station map...
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-zinc-800 text-xs text-zinc-500 flex flex-wrap gap-4">
        <span>Critical: {stationMeta.summary.critical}</span>
        <span>High: {stationMeta.summary.high}</span>
        <span>Medium: {stationMeta.summary.medium}</span>
        <span>Low: {stationMeta.summary.low}</span>
        <span>Auto refresh: {Math.round(REFRESH_MS / 1000)}s</span>
      </div>
    </section>
  );
}
