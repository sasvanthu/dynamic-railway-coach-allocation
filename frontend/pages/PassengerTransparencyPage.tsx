import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Clock, LocateFixed, MapPin, RefreshCcw, Users, Zap } from "lucide-react";
import KPICard from "../components/KPICard";
import LoadingSpinner from "../components/LoadingSpinner";
import backend from "~backend/client";
import { useToast } from "@/components/ui/use-toast";

interface PassengerUpdate {
  id: string;
  train_id: number;
  train_number: string;
  train_name: string;
  current_station: string;
  next_station: string;
  estimated_arrival: string;
  occupancy_level: number;
  estimated_capacity: number;
  seats_available: number;
  delay_minutes: number;
  status: string;
  status_message: string;
  route_name: string;
  data_source: string;
  near_user: boolean;
}

interface PassengerMetrics {
  active_passengers: number;
  real_time_updates: number;
  satisfaction_score: string;
  on_time_performance_percent: number;
}

interface TrainSummary {
  id: number;
  train_number: string;
  name: string;
  origin: string;
  destination: string;
  arrival_time: string | null;
  coach_count: number;
  demand_score: number | null;
  route_name: string | null;
}

interface LiveStatusSummary {
  train_id: number;
  train_number: string;
  train_name: string;
  status: string;
  delay_minutes: number;
  current_station_code: string | null;
  current_station_name: string | null;
  message: string;
  source: string;
  provider: string;
  fetched_at: string | null;
}

interface NearbyStation {
  id: number;
  code: string;
  name: string;
  crowd_density: number | null;
  distance_km: number | null;
}

interface LocationState {
  status: "idle" | "locating" | "ready" | "unsupported" | "denied" | "error";
  lat: number | null;
  lng: number | null;
  message: string;
}

interface LiveStatusFeedMeta {
  providers: string[];
  synced_external: number;
  last_sync: string | null;
}

const PASSENGER_REFRESH_MS = Math.max(10_000, Number(import.meta.env.VITE_PASSENGER_REFRESH_MS ?? 20_000));
const NEARBY_LIMIT = Math.min(10, Math.max(3, Number(import.meta.env.VITE_NEARBY_STATION_LIMIT ?? 5)));

const initialLocationState: LocationState = {
  status: "idle",
  lat: null,
  lng: null,
  message: "Location access not requested",
};

const initialLiveFeedMeta: LiveStatusFeedMeta = {
  providers: [],
  synced_external: 0,
  last_sync: null,
};

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toNullableNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeTrainSummary = (raw: unknown): TrainSummary => {
  const train = (raw ?? {}) as Partial<TrainSummary> & Record<string, unknown>;
  return {
    id: toFiniteNumber(train.id),
    train_number: String(train.train_number ?? "N/A"),
    name: String(train.name ?? "Unknown Train"),
    origin: String(train.origin ?? ""),
    destination: String(train.destination ?? ""),
    arrival_time: train.arrival_time == null ? null : String(train.arrival_time),
    coach_count: Math.max(1, toFiniteNumber(train.coach_count, 12)),
    demand_score: toNullableNumber(train.demand_score),
    route_name: train.route_name == null ? null : String(train.route_name),
  };
};

const normalizeLiveStatus = (raw: unknown): LiveStatusSummary => {
  const status = (raw ?? {}) as Partial<LiveStatusSummary> & Record<string, unknown>;
  return {
    train_id: toFiniteNumber(status.train_id),
    train_number: String(status.train_number ?? "N/A"),
    train_name: String(status.train_name ?? "Unknown Train"),
    status: String(status.status ?? "on_time"),
    delay_minutes: Math.max(0, toFiniteNumber(status.delay_minutes)),
    current_station_code: status.current_station_code == null ? null : String(status.current_station_code),
    current_station_name: status.current_station_name == null ? null : String(status.current_station_name),
    message: String(status.message ?? "Live telemetry feed"),
    source: String(status.source ?? "internal-estimator"),
    provider: String(status.provider ?? "local-ops-model"),
    fetched_at: status.fetched_at == null ? null : String(status.fetched_at),
  };
};

const normalizeNearbyStation = (raw: unknown): NearbyStation => {
  const station = (raw ?? {}) as Partial<NearbyStation> & Record<string, unknown>;
  return {
    id: toFiniteNumber(station.id),
    code: String(station.code ?? "N/A"),
    name: String(station.name ?? "Unknown Station"),
    crowd_density: toNullableNumber(station.crowd_density),
    distance_km: toNullableNumber(station.distance_km),
  };
};

function formatRelativeTimestamp(value: string | null) {
  if (!value) return "No sync recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No sync recorded";

  const diffSec = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  return `${Math.round(diffSec / 3600)}h ago`;
}

function computeETA(arrivalIso: string | null, delayMinutes: number) {
  const fallback = Date.now() + (delayMinutes + 35) * 60_000;
  const base = arrivalIso ? new Date(arrivalIso).getTime() : fallback;
  const eta = Number.isFinite(base) ? base + delayMinutes * 60_000 : fallback;
  return new Date(eta).toISOString();
}

function estimateOccupancy(train: TrainSummary, status: LiveStatusSummary, nearbyStation: NearbyStation | null) {
  const demand = clamp(train.demand_score ?? 0.58, 0.2, 0.95);
  const delayFactor = status.delay_minutes > 0 ? clamp(status.delay_minutes / 40, 0, 0.22) : 0;
  const nearbyCrowdFactor = nearbyStation?.crowd_density != null ? clamp((nearbyStation.crowd_density - 0.45) * 0.4, -0.12, 0.22) : 0;
  const occupancy = clamp((0.38 + demand * 0.42 + delayFactor + nearbyCrowdFactor) * 100, 18, 99);
  return Math.round(occupancy);
}

export default function PassengerTransparencyPage() {
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<PassengerMetrics | null>(null);
  const [updates, setUpdates] = useState<PassengerUpdate[]>([]);
  const [locationState, setLocationState] = useState<LocationState>(initialLocationState);
  const [nearbyStations, setNearbyStations] = useState<NearbyStation[]>([]);
  const [liveStatusMeta, setLiveStatusMeta] = useState<LiveStatusFeedMeta>(initialLiveFeedMeta);
  const nearbyLookupRef = useRef<Map<string, NearbyStation>>(new Map());
  const { toast } = useToast();

  useEffect(() => {
    const lookup = new Map<string, NearbyStation>();
    nearbyStations.forEach((station) => {
      lookup.set(station.code, station);
    });
    nearbyLookupRef.current = lookup;
  }, [nearbyStations]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationState({
        status: "unsupported",
        lat: null,
        lng: null,
        message: "Geolocation unavailable in this browser",
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
        setLocationState({
          status: "ready",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          message: "Live location connected",
        });
      },
      (error) => {
        if (error.code === 1) {
          setLocationState({
            status: "denied",
            lat: null,
            lng: null,
            message: "Location access denied. Enable it to prioritize local station updates.",
          });
          return;
        }

        setLocationState({
          status: "error",
          lat: null,
          lng: null,
          message: "Unable to determine location right now",
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 90_000,
        timeout: 12_000,
      }
    );
  }, []);

  const loadNearby = useCallback(async (lat: number, lng: number, refresh: boolean) => {
    const payload = await backend.railmind.getNearbyStations({ lat, lng, limit: NEARBY_LIMIT, refresh });
    const normalized = Array.isArray(payload.nearby) ? payload.nearby.map((station) => normalizeNearbyStation(station)) : [];
    setNearbyStations(normalized);
  }, []);

  const loadPassengerFeed = useCallback(async (refresh: boolean) => {
    const nearbyByCode = nearbyLookupRef.current;

    const [statusPayload, trainPayload] = await Promise.all([
      backend.railmind.listLiveStatus({ refresh }),
      backend.railmind.listTrains(),
    ]);

    const statuses = Array.isArray(statusPayload.statuses) ? statusPayload.statuses.map((status) => normalizeLiveStatus(status)) : [];
    const trains = Array.isArray(trainPayload.trains) ? trainPayload.trains.map((train) => normalizeTrainSummary(train)) : [];

    setLiveStatusMeta({
      providers: Array.isArray(statusPayload.providers) ? statusPayload.providers : [],
      synced_external: toFiniteNumber(statusPayload.synced_external),
      last_sync: statusPayload.last_sync ?? null,
    });

    const statusByTrainId = new Map<number, LiveStatusSummary>();
    statuses.forEach((status) => {
      statusByTrainId.set(status.train_id, status);
    });

    const updatesList: PassengerUpdate[] = trains.map((train) => {
      const status = statusByTrainId.get(train.id) ?? {
        train_id: train.id,
        train_number: train.train_number,
        train_name: train.name,
        status: "on_time",
        delay_minutes: 0,
        current_station_code: train.origin || null,
        current_station_name: train.origin || null,
        message: "Estimated from schedule",
        source: "internal-estimator",
        provider: "local-ops-model",
        fetched_at: null,
      };

      const nearbyStation = status.current_station_code ? nearbyByCode.get(status.current_station_code) ?? null : null;
      const occupancyLevel = estimateOccupancy(train, status, nearbyStation);
      const estimatedCapacity = train.coach_count * 72;
      const seatsAvailable = Math.max(0, Math.round(estimatedCapacity * (1 - occupancyLevel / 100)));
      const isNearUser = nearbyStation != null;

      return {
        id: `train-${train.id}`,
        train_id: train.id,
        train_number: train.train_number,
        train_name: train.name,
        current_station: status.current_station_name ?? status.current_station_code ?? train.origin,
        next_station: train.destination,
        estimated_arrival: computeETA(train.arrival_time, status.delay_minutes),
        occupancy_level: occupancyLevel,
        estimated_capacity: estimatedCapacity,
        seats_available: seatsAvailable,
        delay_minutes: status.delay_minutes,
        status: status.status,
        status_message: status.message,
        route_name: train.route_name ?? `${train.origin} → ${train.destination}`,
        data_source: `${status.source} / ${status.provider}`,
        near_user: isNearUser,
      };
    });

    updatesList.sort((left, right) => {
      if (left.near_user !== right.near_user) return Number(right.near_user) - Number(left.near_user);
      if (left.delay_minutes !== right.delay_minutes) return right.delay_minutes - left.delay_minutes;
      return right.occupancy_level - left.occupancy_level;
    });

    setUpdates(updatesList);

    const activePassengers = updatesList.reduce((sum, update) => sum + Math.round(update.estimated_capacity * (update.occupancy_level / 100)), 0);
    const onTimeCount = updatesList.filter((update) => update.status === "on_time").length;
    const onTimePerformance = updatesList.length ? Math.round((onTimeCount / updatesList.length) * 100) : 0;

    const nearbyList = [...nearbyByCode.values()];
    const avgNearbyCrowd = nearbyList.length
      ? nearbyList.reduce((sum, station) => sum + (station.crowd_density ?? 0.5), 0) / nearbyList.length
      : 0.55;

    const satisfaction = clamp(4.5 + onTimePerformance / 18 + (1 - avgNearbyCrowd) * 1.5, 5.0, 9.9).toFixed(1);

    setMetrics({
      active_passengers: activePassengers,
      real_time_updates: statuses.length,
      satisfaction_score: satisfaction,
      on_time_performance_percent: onTimePerformance,
    });
  }, []);

  const refreshNow = useCallback(async () => {
    try {
      setSyncing(true);
      if (locationState.status === "ready" && locationState.lat != null && locationState.lng != null) {
        await loadNearby(locationState.lat, locationState.lng, true);
      }
      await loadPassengerFeed(true);
    } catch (error) {
      console.error(error);
      toast({ title: "Failed to refresh live passenger feed", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }, [loadNearby, loadPassengerFeed, locationState.lat, locationState.lng, locationState.status, toast]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        await loadPassengerFeed(true);
      } catch (error) {
        console.error("Error fetching passenger transparency data:", error);
        toast({ title: "Failed to load passenger updates", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    requestLocation();
    const interval = setInterval(() => {
      void loadPassengerFeed(false);
    }, PASSENGER_REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadPassengerFeed, requestLocation, toast]);

  useEffect(() => {
    if (locationState.status !== "ready" || locationState.lat == null || locationState.lng == null) {
      if (locationState.status !== "ready") {
        setNearbyStations([]);
      }
      return;
    }

    void loadNearby(locationState.lat, locationState.lng, true)
      .then(() => loadPassengerFeed(false))
      .catch((error) => {
        console.error(error);
      });
  }, [loadNearby, loadPassengerFeed, locationState.lat, locationState.lng, locationState.status]);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "on_time":
        return "bg-emerald-900/40 text-emerald-400";
      case "delayed":
      case "minor_delay":
        return "bg-amber-900/40 text-amber-400";
      case "cancelled":
      case "major_delay":
        return "bg-red-900/40 text-red-400";
      default:
        return "bg-zinc-800 text-zinc-400";
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-500" />
          Passenger Transparency Feed
        </h1>
        <p className="text-zinc-400 mt-2">Location-sensitive journey updates for citizens with live train telemetry</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => void requestLocation()}
            className="px-3 py-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 transition"
          >
            <span className="inline-flex items-center gap-1.5"><LocateFixed className="w-4 h-4" />Use My Location</span>
          </button>
          <button
            type="button"
            onClick={() => void refreshNow()}
            disabled={syncing}
            className="px-3 py-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-1.5"><RefreshCcw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />Refresh Live Feed</span>
          </button>
          <span className="text-zinc-500">{locationState.message}</span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-500">Last status sync: {formatRelativeTimestamp(liveStatusMeta.last_sync)}</span>
        </div>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard
            title="Active Passengers"
            value={metrics.active_passengers.toLocaleString()}
            icon={Users}
            color="blue"
            subtitle="Estimated onboard in monitored trains"
          />
          <KPICard
            title="Real-Time Updates"
            value={metrics.real_time_updates.toString()}
            icon={Zap}
            color="emerald"
            subtitle={`${liveStatusMeta.synced_external} external-provider snapshots`}
          />
          <KPICard
            title="Satisfaction Score"
            value={metrics.satisfaction_score.toString()}
            icon={AlertCircle}
            color="amber"
            subtitle="Citizen experience index"
          />
          <KPICard
            title="On-Time Performance"
            value={`${metrics.on_time_performance_percent}%`}
            icon={Clock}
            color="purple"
            subtitle={`Refresh every ${Math.round(PASSENGER_REFRESH_MS / 1000)}s`}
          />
        </div>
      )}

      {nearbyStations.length > 0 && (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
          <h2 className="text-sm font-semibold text-zinc-200 mb-2">Nearest Stations To Your Location</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {nearbyStations.map((station) => (
              <div key={station.id} className="rounded-lg border border-zinc-700/70 bg-zinc-800/40 px-3 py-2">
                <p className="text-sm font-semibold text-zinc-100">{station.code} - {station.name}</p>
                <p className="text-xs text-zinc-400">Distance: {station.distance_km != null ? `${station.distance_km.toFixed(1)} km` : "N/A"}</p>
                <p className="text-xs text-zinc-400">Crowd: {station.crowd_density != null ? `${Math.round(station.crowd_density * 100)}%` : "N/A"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            Live Train Updates {nearbyStations.length > 0 ? "Near You" : "Across Network"}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">Providers: {liveStatusMeta.providers.join(", ") || "internal-estimator"}</p>
        </div>
        <div className="space-y-3 p-6">
          {updates.map((update) => (
            <div key={update.id} className="bg-zinc-800/30 rounded-lg p-4 border border-zinc-700/50">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-zinc-100">Train {update.train_number}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadgeColor(update.status)}`}>
                      {update.status.replace("_", " ").toUpperCase()}
                    </span>
                    {update.near_user && (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-sky-500/20 text-sky-300">NEAR YOU</span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400 mb-1">{update.train_name}</p>
                  <div className="flex items-center gap-4 text-sm text-zinc-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      At: {update.current_station}
                    </span>
                    <span>→</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {update.next_station}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">Route: {update.route_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-500">ETA</p>
                  <p className="text-sm font-semibold text-zinc-100">
                    {new Date(update.estimated_arrival).toLocaleTimeString()}
                  </p>
                  {update.delay_minutes > 0 && (
                    <p className="text-xs text-red-400 mt-1">+{update.delay_minutes} min delay</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-3 border-t border-zinc-700/50">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Occupancy</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${update.occupancy_level >= 85 ? "bg-red-500" : update.occupancy_level >= 65 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${update.occupancy_level}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-zinc-100">{update.occupancy_level}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Seats Available</p>
                  <p className="text-sm font-semibold text-emerald-400">{update.seats_available}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Telemetry</p>
                  <p className="text-xs font-semibold text-zinc-100 line-clamp-2">{update.status_message}</p>
                  <p className="text-[11px] text-zinc-500 mt-1">{update.data_source}</p>
                </div>
              </div>
            </div>
          ))}
          {updates.length === 0 && <p className="text-sm text-zinc-500">No live train updates available right now.</p>}
        </div>
      </div>
    </div>
  );
}
