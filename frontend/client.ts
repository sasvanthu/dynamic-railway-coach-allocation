const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

type Query = Record<string, string | number | boolean | undefined | null>;

async function request<T>(path: string, options?: { method?: string; body?: unknown; query?: Query }): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (options?.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url.toString(), {
    method: options?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

const backend = {
  railmind: {
    getDashboard: () => request("/railmind/dashboard"),
    listDisruptions: () => request<{ disruptions: unknown[] }>("/railmind/disruptions"),
    resolveDisruption: ({ id }: { id: number }) => request("/railmind/disruptions/" + id + "/resolve", { method: "POST" }),
    injectDisruption: (body: { trainId: number; type: string; severity: string }) => request("/railmind/disruptions/inject", { method: "POST", body }),

    listTrains: () => request<{ trains: unknown[] }>("/railmind/trains"),
    getTrain: ({ id, refresh }: { id: number; refresh?: boolean }) => request("/railmind/trains/" + id, { query: { refresh } }),

    listLiveRoutes: ({ refresh, trainId }: { refresh?: boolean; trainId?: number } = {}) =>
      request<{ enabled: boolean; provider: string; synced: number; total: number; last_sync: string | null; routes: unknown[] }>("/railmind/live-routes", {
        query: { refresh, trainId },
      }),
    syncLiveRoutes: ({ trainId }: { trainId?: number } = {}) =>
      request<{ success: boolean; provider: string; synced: number; total: number; last_sync: string | null; routes: unknown[] }>("/railmind/live-routes/sync", {
        method: "POST",
        body: { trainId },
      }),

    listLiveStatus: ({ refresh, trainId }: { refresh?: boolean; trainId?: number } = {}) =>
      request<{
        enabled: boolean;
        providers: string[];
        synced_external: number;
        total: number;
        last_sync: string | null;
        summary: { on_time: number; delayed: number; cancelled: number };
        statuses: unknown[];
      }>("/railmind/live-status", {
        query: { refresh, trainId },
      }),
    syncLiveStatus: ({ trainId }: { trainId?: number } = {}) =>
      request<{
        success: boolean;
        providers: string[];
        synced_external: number;
        total: number;
        last_sync: string | null;
        summary: { on_time: number; delayed: number; cancelled: number };
        statuses: unknown[];
      }>("/railmind/live-status/sync", {
        method: "POST",
        body: { trainId },
      }),

    listStations: ({ refresh }: { refresh?: boolean } = {}) => request<{ stations: unknown[]; live_health?: unknown }>("/railmind/stations", { query: { refresh } }),
    listLiveStations: ({ refresh, stationId }: { refresh?: boolean; stationId?: number } = {}) =>
      request<{
        enabled: boolean;
        providers: string[];
        synced_external: number;
        total: number;
        last_sync: string | null;
        summary: { critical: number; high: number; medium: number; low: number };
        stations: unknown[];
      }>("/railmind/stations/live", { query: { refresh, stationId } }),
    syncLiveStations: ({ stationId }: { stationId?: number } = {}) =>
      request<{
        success: boolean;
        providers: string[];
        synced_external: number;
        total: number;
        last_sync: string | null;
        summary: { critical: number; high: number; medium: number; low: number };
        stations: unknown[];
      }>("/railmind/stations/live/sync", { method: "POST", body: { stationId } }),
    getNearbyStations: ({ lat, lng, limit, refresh }: { lat: number; lng: number; limit?: number; refresh?: boolean }) =>
      request<{ location: { lat: number; lng: number }; limit: number; total: number; nearby: unknown[] }>("/railmind/stations/nearby", {
        query: { lat, lng, limit, refresh },
      }),
    getStation: ({ id, refresh }: { id: number; refresh?: boolean }) => request("/railmind/stations/" + id, { query: { refresh } }),

    listForecasts: ({ trainId }: { trainId?: number }) => request<{ forecasts: unknown[] }>("/railmind/forecasts", { query: { trainId } }),
    generateForecasts: () => request<{ success: boolean; forecasts_generated: number }>("/railmind/forecasts/generate", { method: "POST" }),

    listEvents: () => request<{ events: unknown[] }>("/railmind/events"),

    listRakeTransfers: () => request<{ rake_transfers: unknown[] }>("/railmind/rake-transfers"),
    approveRakeTransfer: ({ id }: { id: number }) => request("/railmind/rake-transfers/" + id + "/approve", { method: "POST" }),
    optimizeRakeTransfers: () => request<{ success: boolean; proposals_created: number; total_savings_km: number }>("/railmind/rake-transfers/optimize", { method: "POST" }),

    listSentiment: () => request<{ sentiment: unknown[] }>("/railmind/sentiment"),
    simulateSentiment: () => request<{ success: boolean; records_created: number }>("/railmind/sentiment/simulate", { method: "POST" }),

    listAllocations: ({ trainId }: { trainId?: number }) => request<{ allocations: unknown[] }>("/railmind/allocations", { query: { trainId } }),
    overrideAllocation: (body: { id: number; officialName: string; reason: string; newCoachId: number }) =>
      request("/railmind/allocations/" + body.id + "/override", {
        method: "POST",
        body: { officialName: body.officialName, reason: body.reason, newCoachId: body.newCoachId },
      }),

    listCoaches: ({ status }: { status?: string }) => request<{ coaches: unknown[] }>("/railmind/coaches", { query: { status } }),
    reallocate: (body: { trainId: number; reason: string }) => request<{ success: boolean; allocations_created: number; message: string }>("/railmind/coaches/reallocate", { method: "POST", body }),

    seed: () => request<{ success: boolean; message: string }>("/railmind/seed", { method: "POST" }),
  },
};

export default backend;
