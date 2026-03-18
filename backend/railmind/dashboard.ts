import { api } from "encore.dev/api";
import { getCollection, toIsoString } from "../db";

interface NetworkNode {
  id: number;
  code: string;
  name: string;
  zone: string;
  lat: number;
  lng: number;
  crowd_density: number;
}

interface NetworkEdge {
  source: number;
  target: number;
  route_name: string;
  distance_km: number;
  demand_level: string;
}

interface DashboardStats {
  total_trains: number;
  active_disruptions: number;
  coaches_in_use: number;
  total_coaches: number;
  coaches_utilization_pct: number;
  forecast_accuracy_pct: number;
  deadhead_reduction_pct: number;
  network_nodes: NetworkNode[];
  network_edges: NetworkEdge[];
}

export const getDashboard = api<void, DashboardStats>(
  { expose: true, method: "GET", path: "/railmind/dashboard" },
  async () => {
    const trainsCol = await getCollection("trains");
    const disruptionsCol = await getCollection<{ status: string }>("disruptions");
    const coachesCol = await getCollection<{ status: string }>("coaches");
    const stationsCol = await getCollection<Omit<NetworkNode, "crowd_density">>("stations");
    const sentimentCol = await getCollection<{ station_id: number; crowd_density: number; recorded_at: Date | string }>("sentiment_data");
    const routesCol = await getCollection<{ id: number; name: string; zone_from: string; zone_to: string; distance_km: number }>("routes");
    const forecastsCol = await getCollection<{ demand_score: number; created_at: Date }>("demand_forecasts");

    const [trainCount, disruptionCount, inUseCount, totalCoachCount] = await Promise.all([
      trainsCol.countDocuments({}),
      disruptionsCol.countDocuments({ status: "active" }),
      coachesCol.countDocuments({ status: "in_use" }),
      coachesCol.countDocuments({}),
    ]);

    const stations = await stationsCol.find({}).toArray();
    const latestSentiment = await sentimentCol
      .aggregate<{ station_id: number; crowd_density: number }>([
        { $sort: { recorded_at: -1 } },
        { $group: { _id: "$station_id", crowd_density: { $first: "$crowd_density" } } },
        { $project: { _id: 0, station_id: "$_id", crowd_density: 1 } },
      ])
      .toArray();

    const sentimentMap = new Map(latestSentiment.map((entry) => [entry.station_id, entry.crowd_density]));
    const nodes: NetworkNode[] = stations.map((station) => ({
      ...station,
      crowd_density: sentimentMap.get(station.id) ?? 0.5,
    }));

    const stationMap: Record<string, number> = {};
    for (const node of nodes) {
      stationMap[node.code] = node.id;
    }

    const routes = await routesCol.find({}).toArray();

    const zoneToStation: Record<string, number> = {};
    for (const node of nodes) {
      if (!zoneToStation[node.zone]) zoneToStation[node.zone] = node.id;
    }

    const demandRows = await forecastsCol
      .find({ created_at: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
      .project<{ demand_score: number }>({ demand_score: 1, _id: 0 })
      .toArray();
    const demandAvg = demandRows.length
      ? demandRows.reduce((sum, row) => sum + row.demand_score, 0) / demandRows.length
      : 0.5;

    const edges: NetworkEdge[] = routes.map((r) => {
      const src = zoneToStation[r.zone_from] ?? nodes[0]?.id ?? 1;
      const tgt = zoneToStation[r.zone_to] ?? nodes[1]?.id ?? 2;
      const demandLevel = demandAvg > 0.75 ? "high" : demandAvg > 0.5 ? "medium" : "low";
      return { source: src, target: tgt, route_name: r.name, distance_km: r.distance_km, demand_level: demandLevel };
    });

    const inUse = inUseCount;
    const total = totalCoachCount || 1;
    const utilizationPct = Math.round((inUse / total) * 100);

    return {
      total_trains: trainCount,
      active_disruptions: disruptionCount,
      coaches_in_use: inUse,
      total_coaches: total,
      coaches_utilization_pct: utilizationPct,
      forecast_accuracy_pct: 87,
      deadhead_reduction_pct: 34,
      network_nodes: nodes,
      network_edges: edges,
    };
  }
);

interface Event {
  id: number;
  name: string;
  type: string;
  location: string;
  start_date: string;
  end_date: string;
  expected_attendance: number;
  affected_stations: number[];
  impact_score: number;
}

interface ListEventsResponse {
  events: Event[];
}

export const listEvents = api<void, ListEventsResponse>(
  { expose: true, method: "GET", path: "/railmind/events" },
  async () => {
    const eventsCol = await getCollection<Omit<Event, "impact_score" | "start_date" | "end_date"> & {
      start_date: Date | string;
      end_date: Date | string;
    }>("events");

    const rows = await eventsCol.find({}).sort({ start_date: 1 }).toArray();
    const events: Event[] = rows.map((e) => ({
      ...e,
      start_date: toIsoString(e.start_date) ?? new Date().toISOString(),
      end_date: toIsoString(e.end_date) ?? new Date().toISOString(),
      impact_score: Math.min(1.0, e.expected_attendance / 5000000),
    }));
    return { events };
  }
);
