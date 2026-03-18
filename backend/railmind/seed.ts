import { api } from "encore.dev/api";
import { getCollection } from "../db";

interface SeedResponse {
  success: boolean;
  message: string;
}

export const seed = api<void, SeedResponse>(
  { expose: true, method: "POST", path: "/railmind/seed" },
  async () => {
    const stationsCol = await getCollection("stations");
    const routesCol = await getCollection("routes");
    const trainsCol = await getCollection("trains");
    const coachesCol = await getCollection("coaches");
    const allocationsCol = await getCollection("allocations");
    const forecastsCol = await getCollection("demand_forecasts");
    const disruptionsCol = await getCollection("disruptions");
    const sentimentCol = await getCollection("sentiment_data");
    const rakeTransfersCol = await getCollection("rake_transfers");
    const eventsCol = await getCollection("events");
    const overrideLogsCol = await getCollection("override_logs");
    const countersCol = await getCollection<{ _id: string; value: number }>("counters");

    const collections = [
      overrideLogsCol,
      forecastsCol,
      disruptionsCol,
      sentimentCol,
      rakeTransfersCol,
      allocationsCol,
      coachesCol,
      trainsCol,
      eventsCol,
      routesCol,
      stationsCol,
    ];

    for (const collection of collections) {
      await collection.deleteMany({});
    }

    const now = new Date();
    const inHours = (hours: number) => new Date(now.getTime() + hours * 60 * 60 * 1000);
    const inDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const agoMinutes = (minutes: number) => new Date(now.getTime() - minutes * 60 * 1000);

    const stations = [
      { id: 1, code: "NDLS", name: "New Delhi", zone: "North", lat: 28.6448, lng: 77.2167, platform_count: 16 },
      { id: 2, code: "BCT", name: "Mumbai Central", zone: "West", lat: 18.9696, lng: 72.8194, platform_count: 8 },
      { id: 3, code: "MAS", name: "Chennai Central", zone: "South", lat: 13.0827, lng: 80.2707, platform_count: 12 },
      { id: 4, code: "HWH", name: "Howrah Junction", zone: "East", lat: 22.5839, lng: 88.3424, platform_count: 23 },
      { id: 5, code: "SBC", name: "Bengaluru City", zone: "South", lat: 12.9785, lng: 77.5714, platform_count: 10 },
      { id: 6, code: "JP", name: "Jaipur Junction", zone: "North", lat: 26.9124, lng: 75.7873, platform_count: 6 },
      { id: 7, code: "ADI", name: "Ahmedabad Junction", zone: "West", lat: 23.0258, lng: 72.598, platform_count: 10 },
      { id: 8, code: "NGP", name: "Nagpur Junction", zone: "Central", lat: 21.1458, lng: 79.0882, platform_count: 8 },
      { id: 9, code: "HYB", name: "Hyderabad Deccan", zone: "South", lat: 17.385, lng: 78.4867, platform_count: 6 },
      { id: 10, code: "LKO", name: "Lucknow Charbagh", zone: "North", lat: 26.8379, lng: 80.9077, platform_count: 9 },
    ];

    const routes = [
      { id: 1, name: "Rajdhani Express Route", zone_from: "North", zone_to: "West", distance_km: 1384, intermediate_stations: ["JP", "ADI"] },
      { id: 2, name: "Coromandel Express Route", zone_from: "East", zone_to: "South", distance_km: 1663, intermediate_stations: ["NGP", "HYB"] },
      { id: 3, name: "Duronto Express Route", zone_from: "North", zone_to: "South", distance_km: 2180, intermediate_stations: ["NGP", "HYB", "SBC"] },
      { id: 4, name: "Shatabdi Express Route", zone_from: "North", zone_to: "Central", distance_km: 1092, intermediate_stations: ["LKO", "NGP"] },
      { id: 5, name: "Garib Rath Route", zone_from: "West", zone_to: "South", distance_km: 1036, intermediate_stations: ["NGP", "HYB"] },
      { id: 6, name: "Intercity Express Route", zone_from: "North", zone_to: "East", distance_km: 1528, intermediate_stations: ["LKO", "NGP"] },
    ];

    const trains = [
      { id: 1, train_number: "12951", name: "Mumbai Rajdhani", origin: "NDLS", destination: "BCT", departure_time: inHours(2), arrival_time: inHours(18), status: "on_time", route_id: 1 },
      { id: 2, train_number: "12841", name: "Coromandel Express", origin: "HWH", destination: "MAS", departure_time: inHours(4), arrival_time: inHours(28), status: "delayed", route_id: 2 },
      { id: 3, train_number: "12269", name: "Chennai Duronto", origin: "NDLS", destination: "MAS", departure_time: inHours(6), arrival_time: inHours(36), status: "on_time", route_id: 3 },
      { id: 4, train_number: "12001", name: "Bhopal Shatabdi", origin: "NDLS", destination: "NGP", departure_time: inHours(1), arrival_time: inHours(9), status: "on_time", route_id: 4 },
      { id: 5, train_number: "12215", name: "Garib Rath Express", origin: "BCT", destination: "MAS", departure_time: inHours(8), arrival_time: inHours(26), status: "on_time", route_id: 5 },
      { id: 6, train_number: "12453", name: "Rajdhani Express", origin: "NDLS", destination: "HWH", departure_time: inHours(3), arrival_time: inHours(20), status: "cancelled", route_id: 6 },
      { id: 7, train_number: "22691", name: "Rajdhani Express BLR", origin: "NDLS", destination: "SBC", departure_time: inHours(5), arrival_time: inHours(34), status: "on_time", route_id: 3 },
      { id: 8, train_number: "12625", name: "Kerala Express", origin: "NDLS", destination: "MAS", departure_time: inHours(7), arrival_time: inHours(42), status: "delayed", route_id: 3 },
    ];

    const coaches = [
      { id: 1, coach_number: "A1-001", coach_type: "AC1", capacity: 18, status: "in_use", current_train_id: 1, current_station_id: 1 },
      { id: 2, coach_number: "A1-002", coach_type: "AC1", capacity: 18, status: "in_use", current_train_id: 1, current_station_id: 1 },
      { id: 3, coach_number: "A2-001", coach_type: "AC2", capacity: 46, status: "in_use", current_train_id: 1, current_station_id: 1 },
      { id: 4, coach_number: "A2-002", coach_type: "AC2", capacity: 46, status: "in_use", current_train_id: 2, current_station_id: 4 },
      { id: 5, coach_number: "A3-001", coach_type: "AC3", capacity: 64, status: "in_use", current_train_id: 2, current_station_id: 4 },
      { id: 6, coach_number: "A3-002", coach_type: "AC3", capacity: 64, status: "in_use", current_train_id: 3, current_station_id: 1 },
      { id: 7, coach_number: "SL-001", coach_type: "SL", capacity: 72, status: "in_use", current_train_id: 1, current_station_id: 1 },
      { id: 8, coach_number: "SL-002", coach_type: "SL", capacity: 72, status: "in_use", current_train_id: 2, current_station_id: 4 },
      { id: 9, coach_number: "GEN-001", coach_type: "GEN", capacity: 90, status: "in_use", current_train_id: 3, current_station_id: 1 },
      { id: 10, coach_number: "A2-003", coach_type: "AC2", capacity: 46, status: "available", current_train_id: null, current_station_id: null },
      { id: 11, coach_number: "A2-004", coach_type: "AC2", capacity: 46, status: "available", current_train_id: null, current_station_id: null },
      { id: 12, coach_number: "A3-003", coach_type: "AC3", capacity: 64, status: "available", current_train_id: null, current_station_id: null },
      { id: 13, coach_number: "A3-004", coach_type: "AC3", capacity: 64, status: "available", current_train_id: null, current_station_id: null },
      { id: 14, coach_number: "SL-003", coach_type: "SL", capacity: 72, status: "available", current_train_id: null, current_station_id: null },
      { id: 15, coach_number: "GEN-002", coach_type: "GEN", capacity: 90, status: "maintenance", current_train_id: null, current_station_id: null },
    ];

    const allocations = [
      { id: 1, train_id: 1, coach_id: 1, position: 1, allocated_at: inHours(-48), allocated_reason: "High demand forecast", shap_factors: { demand_forecast: 0.34, event_impact: 0.28, historical_avg: 0.22, weather: 0.1, sentiment: 0.06 }, override_by: null, override_reason: null },
      { id: 2, train_id: 1, coach_id: 2, position: 2, allocated_at: inHours(-48), allocated_reason: "High demand forecast", shap_factors: { demand_forecast: 0.3, event_impact: 0.25, historical_avg: 0.25, weather: 0.12, sentiment: 0.08 }, override_by: null, override_reason: null },
      { id: 3, train_id: 1, coach_id: 3, position: 3, allocated_at: inHours(-48), allocated_reason: "Festival season", shap_factors: { demand_forecast: 0.4, event_impact: 0.32, historical_avg: 0.15, weather: 0.08, sentiment: 0.05 }, override_by: null, override_reason: null },
      { id: 4, train_id: 2, coach_id: 4, position: 1, allocated_at: inHours(-24), allocated_reason: "Crowd surge", shap_factors: { demand_forecast: 0.42, event_impact: 0.3, historical_avg: 0.15, weather: 0.08, sentiment: 0.05 }, override_by: null, override_reason: null },
      { id: 5, train_id: 2, coach_id: 5, position: 2, allocated_at: inHours(-24), allocated_reason: "Peak season", shap_factors: { demand_forecast: 0.35, event_impact: 0.25, historical_avg: 0.22, weather: 0.11, sentiment: 0.07 }, override_by: null, override_reason: null },
      { id: 6, train_id: 3, coach_id: 6, position: 1, allocated_at: inHours(-12), allocated_reason: "Long route demand", shap_factors: { demand_forecast: 0.36, event_impact: 0.22, historical_avg: 0.24, weather: 0.11, sentiment: 0.07 }, override_by: null, override_reason: null },
      { id: 7, train_id: 1, coach_id: 7, position: 4, allocated_at: inHours(-10), allocated_reason: "Economy demand", shap_factors: { demand_forecast: 0.22, event_impact: 0.15, historical_avg: 0.38, weather: 0.15, sentiment: 0.1 }, override_by: null, override_reason: null },
      { id: 8, train_id: 2, coach_id: 8, position: 3, allocated_at: inHours(-8), allocated_reason: "Economy demand", shap_factors: { demand_forecast: 0.25, event_impact: 0.18, historical_avg: 0.35, weather: 0.14, sentiment: 0.08 }, override_by: null, override_reason: null },
      { id: 9, train_id: 3, coach_id: 9, position: 2, allocated_at: inHours(-6), allocated_reason: "General quota", shap_factors: { demand_forecast: 0.2, event_impact: 0.12, historical_avg: 0.42, weather: 0.16, sentiment: 0.1 }, override_by: null, override_reason: null },
    ];

    const demandForecasts = [
      { id: 1, train_id: 1, station_id: 1, forecast_time: inHours(6), demand_score: 0.87, confidence: 0.92, factors: { event_boost: 0.3, historical: 0.4, weather: 0.1, time_of_day: 0.2 }, created_at: now },
      { id: 2, train_id: 1, station_id: 2, forecast_time: inHours(12), demand_score: 0.72, confidence: 0.88, factors: { event_boost: 0.25, historical: 0.45, weather: 0.12, time_of_day: 0.18 }, created_at: now },
      { id: 3, train_id: 2, station_id: 4, forecast_time: inHours(4), demand_score: 0.91, confidence: 0.85, factors: { event_boost: 0.45, historical: 0.3, weather: 0.08, time_of_day: 0.17 }, created_at: now },
      { id: 4, train_id: 3, station_id: 3, forecast_time: inHours(18), demand_score: 0.78, confidence: 0.82, factors: { event_boost: 0.35, historical: 0.38, weather: 0.09, time_of_day: 0.18 }, created_at: now },
      { id: 5, train_id: 7, station_id: 5, forecast_time: inHours(30), demand_score: 0.75, confidence: 0.89, factors: { event_boost: 0.32, historical: 0.4, weather: 0.1, time_of_day: 0.18 }, created_at: now },
    ];

    const disruptions = [
      {
        id: 1,
        train_id: 2,
        type: "delay",
        severity: "high",
        detected_at: inHours(-2),
        resolved_at: null,
        cascade_impact: { affected_trains: [2, 8], estimated_delay_min: 85, coaches_to_reassign: 3 },
        status: "active",
        auto_suggestions: [{ type: "coach_rescue", from_train: 6, to_train: 2, coaches: 2, rationale: "Move spare AC3 coaches to affected service" }],
      },
      {
        id: 2,
        train_id: 6,
        type: "cancellation",
        severity: "critical",
        detected_at: inHours(-4),
        resolved_at: null,
        cascade_impact: { affected_trains: [6, 1, 4], estimated_delay_min: 0, coaches_to_reassign: 7 },
        status: "active",
        auto_suggestions: [{ type: "passenger_diversion", from_train: 6, to_train: 4, coaches: 2, rationale: "Route passengers via alternate train" }],
      },
    ];

    const sentimentData = [
      { id: 1, station_id: 1, source: "cctv", score: 0.45, crowd_density: 0.82, message: "High crowd density detected near platform 3.", recorded_at: agoMinutes(15) },
      { id: 2, station_id: 1, source: "social", score: 0.35, crowd_density: 0.78, message: "Long queues reported by passengers.", recorded_at: agoMinutes(30) },
      { id: 3, station_id: 2, source: "cctv", score: 0.72, crowd_density: 0.45, message: "Normal crowd levels.", recorded_at: agoMinutes(20) },
      { id: 4, station_id: 4, source: "cctv", score: 0.38, crowd_density: 0.88, message: "Festival surge observed.", recorded_at: agoMinutes(10) },
      { id: 5, station_id: 5, source: "kiosk", score: 0.7, crowd_density: 0.48, message: "Operations stable.", recorded_at: agoMinutes(18) },
    ];

    const rakeTransfers = [
      { id: 1, from_zone: "North", to_zone: "East", coach_ids: [10, 11, 12], scheduled_at: inHours(6), status: "proposed", estimated_savings_km: 842.5 },
      { id: 2, from_zone: "West", to_zone: "South", coach_ids: [13, 14], scheduled_at: inHours(12), status: "proposed", estimated_savings_km: 1120 },
      { id: 3, from_zone: "Central", to_zone: "North", coach_ids: [11, 12], scheduled_at: inHours(3), status: "approved", estimated_savings_km: 563.2 },
    ];

    const events = [
      { id: 1, name: "Diwali Festival", type: "festival", location: "Pan India", start_date: inDays(5), end_date: inDays(8), expected_attendance: 5000000, affected_stations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      { id: 2, name: "IPL Cricket Finals", type: "sports", location: "Mumbai", start_date: inDays(2), end_date: inDays(2), expected_attendance: 80000, affected_stations: [2, 7] },
      { id: 3, name: "Election Rally", type: "election", location: "Jaipur", start_date: inDays(1), end_date: inDays(1), expected_attendance: 200000, affected_stations: [6, 1] },
    ];

    await stationsCol.insertMany(stations);
    await routesCol.insertMany(routes);
    await trainsCol.insertMany(trains);
    await coachesCol.insertMany(coaches);
    await allocationsCol.insertMany(allocations);
    await forecastsCol.insertMany(demandForecasts);
    await disruptionsCol.insertMany(disruptions);
    await sentimentCol.insertMany(sentimentData);
    await rakeTransfersCol.insertMany(rakeTransfers);
    await eventsCol.insertMany(events);

    const counterValues: Record<string, number> = {
      stations: stations.length,
      routes: routes.length,
      trains: trains.length,
      coaches: coaches.length,
      allocations: allocations.length,
      demand_forecasts: demandForecasts.length,
      disruptions: disruptions.length,
      sentiment_data: sentimentData.length,
      rake_transfers: rakeTransfers.length,
      override_logs: 0,
      events: events.length,
    };

    await countersCol.deleteMany({});
    for (const [key, value] of Object.entries(counterValues)) {
      await countersCol.insertOne({ _id: key, value });
    }

    return { success: true, message: "MongoDB seeded with RailMind sample data" };
  }
);
