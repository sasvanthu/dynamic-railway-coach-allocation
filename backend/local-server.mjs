import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();
const PORT = Number(process.env.PORT || 4000);
const MONGODB_URI = process.env.MONGODB_URI;

let runtimeMode = 'offline-memory';

const app = express();
app.use(cors());
app.use(express.json());

const now = () => new Date();
const iso = (value) => new Date(value).toISOString();

const db = {
  counters: {
    disruptions: 2,
    demand_forecasts: 3,
    rake_transfers: 3,
    sentiment_data: 5,
    allocations: 4,
    override_logs: 0,
  },
  stations: [
    { id: 1, code: 'NDLS', name: 'New Delhi', zone: 'North', lat: 28.6448, lng: 77.2167, platform_count: 16 },
    { id: 2, code: 'BCT', name: 'Mumbai Central', zone: 'West', lat: 18.9696, lng: 72.8194, platform_count: 8 },
    { id: 3, code: 'MAS', name: 'Chennai Central', zone: 'South', lat: 13.0827, lng: 80.2707, platform_count: 12 },
    { id: 4, code: 'HWH', name: 'Howrah Junction', zone: 'East', lat: 22.5839, lng: 88.3424, platform_count: 23 },
    { id: 5, code: 'SBC', name: 'Bengaluru City', zone: 'South', lat: 12.9785, lng: 77.5714, platform_count: 10 },
    { id: 6, code: 'JP', name: 'Jaipur Junction', zone: 'North', lat: 26.9124, lng: 75.7873, platform_count: 6 },
    { id: 7, code: 'ADI', name: 'Ahmedabad Junction', zone: 'West', lat: 23.0258, lng: 72.5980, platform_count: 10 },
    { id: 8, code: 'NGP', name: 'Nagpur Junction', zone: 'Central', lat: 21.1458, lng: 79.0882, platform_count: 8 },
    { id: 9, code: 'HYB', name: 'Hyderabad Deccan', zone: 'South', lat: 17.3850, lng: 78.4867, platform_count: 6 },
    { id: 10, code: 'LKO', name: 'Lucknow Charbagh', zone: 'North', lat: 26.8379, lng: 80.9077, platform_count: 9 },
  ],
  routes: [
    { id: 1, name: 'Rajdhani Express Route', zone_from: 'North', zone_to: 'West', distance_km: 1384 },
    { id: 2, name: 'Coromandel Express Route', zone_from: 'East', zone_to: 'South', distance_km: 1663 },
    { id: 3, name: 'Duronto Express Route', zone_from: 'North', zone_to: 'South', distance_km: 2180 },
    { id: 4, name: 'Shatabdi Express Route', zone_from: 'North', zone_to: 'Central', distance_km: 1092 },
    { id: 5, name: 'Garib Rath Route', zone_from: 'West', zone_to: 'South', distance_km: 1036 },
  ],
  trains: [
    { id: 1, train_number: '12951', name: 'Mumbai Rajdhani', origin: 'NDLS', destination: 'BCT', departure_time: new Date(Date.now() + 2 * 3600_000), arrival_time: new Date(Date.now() + 18 * 3600_000), status: 'on_time', route_id: 1 },
    { id: 2, train_number: '12841', name: 'Coromandel Express', origin: 'HWH', destination: 'MAS', departure_time: new Date(Date.now() + 4 * 3600_000), arrival_time: new Date(Date.now() + 28 * 3600_000), status: 'delayed', route_id: 2 },
    { id: 3, train_number: '12269', name: 'Chennai Duronto', origin: 'NDLS', destination: 'MAS', departure_time: new Date(Date.now() + 6 * 3600_000), arrival_time: new Date(Date.now() + 36 * 3600_000), status: 'on_time', route_id: 3 },
    { id: 4, train_number: '12001', name: 'Bhopal Shatabdi', origin: 'NDLS', destination: 'NGP', departure_time: new Date(Date.now() + 1 * 3600_000), arrival_time: new Date(Date.now() + 9 * 3600_000), status: 'on_time', route_id: 4 },
    { id: 5, train_number: '12215', name: 'Garib Rath Express', origin: 'BCT', destination: 'MAS', departure_time: new Date(Date.now() + 8 * 3600_000), arrival_time: new Date(Date.now() + 26 * 3600_000), status: 'on_time', route_id: 5 },
    { id: 6, train_number: '12453', name: 'Rajdhani Express', origin: 'NDLS', destination: 'HWH', departure_time: new Date(Date.now() + 3 * 3600_000), arrival_time: new Date(Date.now() + 20 * 3600_000), status: 'cancelled', route_id: 1 },
    { id: 7, train_number: '22691', name: 'Rajdhani Express BLR', origin: 'NDLS', destination: 'SBC', departure_time: new Date(Date.now() + 5 * 3600_000), arrival_time: new Date(Date.now() + 34 * 3600_000), status: 'on_time', route_id: 3 },
    { id: 8, train_number: '12625', name: 'Kerala Express', origin: 'NDLS', destination: 'MAS', departure_time: new Date(Date.now() + 7 * 3600_000), arrival_time: new Date(Date.now() + 42 * 3600_000), status: 'delayed', route_id: 3 },
  ],
  coaches: [
    { id: 1, coach_number: 'A1-001', coach_type: 'AC1', capacity: 18, status: 'in_use', current_train_id: 1, current_station_id: 1 },
    { id: 2, coach_number: 'A1-002', coach_type: 'AC1', capacity: 18, status: 'in_use', current_train_id: 1, current_station_id: 1 },
    { id: 3, coach_number: 'A2-001', coach_type: 'AC2', capacity: 46, status: 'in_use', current_train_id: 1, current_station_id: 1 },
    { id: 4, coach_number: 'A2-002', coach_type: 'AC2', capacity: 46, status: 'in_use', current_train_id: 2, current_station_id: 4 },
    { id: 5, coach_number: 'A3-001', coach_type: 'AC3', capacity: 64, status: 'in_use', current_train_id: 2, current_station_id: 4 },
    { id: 6, coach_number: 'A3-002', coach_type: 'AC3', capacity: 64, status: 'in_use', current_train_id: 3, current_station_id: 1 },
    { id: 7, coach_number: 'SL-001', coach_type: 'SL', capacity: 72, status: 'in_use', current_train_id: 1, current_station_id: 1 },
    { id: 8, coach_number: 'SL-002', coach_type: 'SL', capacity: 72, status: 'in_use', current_train_id: 2, current_station_id: 4 },
    { id: 9, coach_number: 'GEN-001', coach_type: 'GEN', capacity: 90, status: 'in_use', current_train_id: 3, current_station_id: 1 },
    { id: 10, coach_number: 'A2-003', coach_type: 'AC2', capacity: 46, status: 'available', current_train_id: null, current_station_id: null },
    { id: 11, coach_number: 'A2-004', coach_type: 'AC2', capacity: 46, status: 'available', current_train_id: null, current_station_id: null },
    { id: 12, coach_number: 'A3-003', coach_type: 'AC3', capacity: 64, status: 'available', current_train_id: null, current_station_id: null },
    { id: 13, coach_number: 'A3-004', coach_type: 'AC3', capacity: 64, status: 'available', current_train_id: null, current_station_id: null },
    { id: 14, coach_number: 'SL-003', coach_type: 'SL', capacity: 72, status: 'available', current_train_id: null, current_station_id: null },
    { id: 15, coach_number: 'GEN-002', coach_type: 'GEN', capacity: 90, status: 'maintenance', current_train_id: null, current_station_id: null },
  ],
  allocations: [
    { id: 1, train_id: 1, coach_id: 1, position: 1, allocated_at: new Date(Date.now() - 48 * 3600_000), allocated_reason: 'High demand forecast', shap_factors: { demand_forecast: 0.34, event_impact: 0.28, historical_avg: 0.22, weather: 0.1, sentiment: 0.06 }, override_by: null, override_reason: null },
    { id: 2, train_id: 1, coach_id: 2, position: 2, allocated_at: new Date(Date.now() - 48 * 3600_000), allocated_reason: 'High demand forecast', shap_factors: { demand_forecast: 0.30, event_impact: 0.25, historical_avg: 0.25, weather: 0.12, sentiment: 0.08 }, override_by: null, override_reason: null },
    { id: 3, train_id: 2, coach_id: 4, position: 1, allocated_at: new Date(Date.now() - 24 * 3600_000), allocated_reason: 'Crowd surge', shap_factors: { demand_forecast: 0.42, event_impact: 0.30, historical_avg: 0.15, weather: 0.08, sentiment: 0.05 }, override_by: null, override_reason: null },
    { id: 4, train_id: 3, coach_id: 6, position: 1, allocated_at: new Date(Date.now() - 12 * 3600_000), allocated_reason: 'Long route demand', shap_factors: { demand_forecast: 0.36, event_impact: 0.22, historical_avg: 0.24, weather: 0.11, sentiment: 0.07 }, override_by: null, override_reason: null },
  ],
  demand_forecasts: [
    { id: 1, train_id: 1, station_id: 1, forecast_time: new Date(Date.now() + 6 * 3600_000), demand_score: 0.87, confidence: 0.92, factors: { event_boost: 0.3, historical: 0.4, weather: 0.1, time_of_day: 0.2 }, created_at: now() },
    { id: 2, train_id: 2, station_id: 4, forecast_time: new Date(Date.now() + 4 * 3600_000), demand_score: 0.91, confidence: 0.85, factors: { event_boost: 0.45, historical: 0.3, weather: 0.08, time_of_day: 0.17 }, created_at: now() },
    { id: 3, train_id: 3, station_id: 3, forecast_time: new Date(Date.now() + 18 * 3600_000), demand_score: 0.78, confidence: 0.82, factors: { event_boost: 0.35, historical: 0.38, weather: 0.09, time_of_day: 0.18 }, created_at: now() },
  ],
  disruptions: [
    { id: 1, train_id: 2, type: 'delay', severity: 'high', detected_at: new Date(Date.now() - 2 * 3600_000), resolved_at: null, cascade_impact: { affected_trains: [2, 8], estimated_delay_min: 85, coaches_to_reassign: 3 }, status: 'active', auto_suggestions: [{ type: 'coach_rescue', from_train: 6, to_train: 2, coaches: 2, rationale: 'Move spare AC3 coaches to affected service' }] },
    { id: 2, train_id: 6, type: 'cancellation', severity: 'critical', detected_at: new Date(Date.now() - 4 * 3600_000), resolved_at: null, cascade_impact: { affected_trains: [6, 1, 4], estimated_delay_min: 0, coaches_to_reassign: 7 }, status: 'active', auto_suggestions: [{ type: 'passenger_diversion', from_train: 6, to_train: 4, coaches: 2, rationale: 'Route passengers via alternate train' }] },
  ],
  sentiment_data: [
    { id: 1, station_id: 1, source: 'cctv', score: 0.45, crowd_density: 0.82, message: 'High crowd density detected near platform 3.', recorded_at: new Date(Date.now() - 15 * 60_000) },
    { id: 2, station_id: 1, source: 'social', score: 0.35, crowd_density: 0.78, message: 'Long queues reported by passengers.', recorded_at: new Date(Date.now() - 30 * 60_000) },
    { id: 3, station_id: 2, source: 'cctv', score: 0.72, crowd_density: 0.45, message: 'Normal crowd levels.', recorded_at: new Date(Date.now() - 20 * 60_000) },
    { id: 4, station_id: 4, source: 'cctv', score: 0.38, crowd_density: 0.88, message: 'Festival surge observed.', recorded_at: new Date(Date.now() - 10 * 60_000) },
    { id: 5, station_id: 5, source: 'kiosk', score: 0.70, crowd_density: 0.48, message: 'Operations stable.', recorded_at: new Date(Date.now() - 18 * 60_000) },
  ],
  rake_transfers: [
    { id: 1, from_zone: 'North', to_zone: 'East', coach_ids: [10, 11, 12], scheduled_at: new Date(Date.now() + 6 * 3600_000), status: 'proposed', estimated_savings_km: 842.5 },
    { id: 2, from_zone: 'West', to_zone: 'South', coach_ids: [13, 14], scheduled_at: new Date(Date.now() + 12 * 3600_000), status: 'proposed', estimated_savings_km: 1120.0 },
    { id: 3, from_zone: 'Central', to_zone: 'North', coach_ids: [11, 12], scheduled_at: new Date(Date.now() + 3 * 3600_000), status: 'approved', estimated_savings_km: 563.2 },
  ],
  override_logs: [],
  events: [
    { id: 1, name: 'Diwali Festival', type: 'festival', location: 'Pan India', start_date: new Date(Date.now() + 5 * 24 * 3600_000), end_date: new Date(Date.now() + 8 * 24 * 3600_000), expected_attendance: 5000000, affected_stations: [1,2,3,4,5,6,7,8,9,10] },
    { id: 2, name: 'IPL Cricket Finals', type: 'sports', location: 'Mumbai', start_date: new Date(Date.now() + 2 * 24 * 3600_000), end_date: new Date(Date.now() + 2 * 24 * 3600_000), expected_attendance: 80000, affected_stations: [2,7] },
    { id: 3, name: 'Election Rally', type: 'election', location: 'Jaipur', start_date: new Date(Date.now() + 1 * 24 * 3600_000), end_date: new Date(Date.now() + 1 * 24 * 3600_000), expected_attendance: 200000, affected_stations: [6,1] },
  ],
};

const trainById = (id) => db.trains.find((train) => train.id === id);
const stationById = (id) => db.stations.find((station) => station.id === id);
const coachById = (id) => db.coaches.find((coach) => coach.id === id);

const LIVE_ROUTE_ENABLED = (process.env.LIVE_ROUTE_ENABLED ?? 'true').toLowerCase() !== 'false';
const LIVE_ROUTE_CACHE_TTL_MS = Number(process.env.LIVE_ROUTE_CACHE_TTL_MS ?? 60 * 60_000);
const LIVE_ROUTE_TIMEOUT_MS = Number(process.env.LIVE_ROUTE_TIMEOUT_MS ?? 8_000);
const LIVE_ROUTE_MAX_POINTS = Number(process.env.LIVE_ROUTE_MAX_POINTS ?? 350);
const LIVE_ROUTE_SYNC_DELAY_MS = Number(process.env.LIVE_ROUTE_SYNC_DELAY_MS ?? 400);
const LIVE_ROUTE_OVERPASS_URL = process.env.LIVE_ROUTE_OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const LIVE_ROUTE_OVERPASS_URLS = (process.env.LIVE_ROUTE_OVERPASS_URLS ?? [
  LIVE_ROUTE_OVERPASS_URL,
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/cgi/interpreter',
].join(','))
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

const LIVE_STATUS_ENABLED = (process.env.LIVE_STATUS_ENABLED ?? 'true').toLowerCase() !== 'false';
const LIVE_STATUS_CACHE_TTL_MS = Number(process.env.LIVE_STATUS_CACHE_TTL_MS ?? 90_000);
const LIVE_STATUS_TIMEOUT_MS = Number(process.env.LIVE_STATUS_TIMEOUT_MS ?? 6_000);
const LIVE_STATUS_SYNC_DELAY_MS = Number(process.env.LIVE_STATUS_SYNC_DELAY_MS ?? 180);
const LIVE_STATUS_API_URL_TEMPLATE = process.env.LIVE_STATUS_API_URL_TEMPLATE ?? '';
const LIVE_STATUS_API_KEY = process.env.LIVE_STATUS_API_KEY ?? '';
const LIVE_STATUS_API_AUTH_HEADER = process.env.LIVE_STATUS_API_AUTH_HEADER ?? 'x-api-key';
const LIVE_STATUS_RAPIDAPI_KEY = process.env.LIVE_STATUS_RAPIDAPI_KEY ?? '';
const LIVE_STATUS_RAPIDAPI_HOST = (process.env.LIVE_STATUS_RAPIDAPI_HOST ?? 'irctc1.p.rapidapi.com')
  .replace(/^https?:\/\//, '')
  .trim();

const STATION_LIVE_ENABLED = (process.env.STATION_LIVE_ENABLED ?? 'true').toLowerCase() !== 'false';
const STATION_LIVE_CACHE_TTL_MS = Number(process.env.STATION_LIVE_CACHE_TTL_MS ?? 25_000);
const STATION_LIVE_TIMEOUT_MS = Number(process.env.STATION_LIVE_TIMEOUT_MS ?? 5_000);
const STATION_LIVE_SYNC_DELAY_MS = Number(process.env.STATION_LIVE_SYNC_DELAY_MS ?? 120);
const STATION_CROWD_API_URL_TEMPLATE = process.env.STATION_CROWD_API_URL_TEMPLATE ?? '';
const STATION_CROWD_API_KEY = process.env.STATION_CROWD_API_KEY ?? '';
const STATION_CROWD_API_AUTH_HEADER = process.env.STATION_CROWD_API_AUTH_HEADER ?? 'x-api-key';
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY ?? '';
const OPENWEATHER_UNITS = process.env.OPENWEATHER_UNITS ?? 'metric';

const liveRouteCache = new Map();
const liveRouteInFlight = new Map();
const liveStatusCache = new Map();
const liveStatusInFlight = new Map();
const liveStationCache = new Map();
const liveStationInFlight = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const round1 = (value) => Number(value.toFixed(1));
const toRad = (value) => (value * Math.PI) / 180;
const haversineKm = (left, right) => {
  const r = 6371;
  const dLat = toRad(right.lat - left.lat);
  const dLng = toRad(right.lng - left.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(left.lat)) * Math.cos(toRad(right.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const polylineDistanceKm = (points) => {
  if (points.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += haversineKm(points[index - 1], points[index]);
  }
  return total;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compressWhitespace = (value) => value.replace(/\s+/g, ' ').trim();
const escapeOverpassPattern = (value) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const stationQueryPattern = (name) => {
  const normalized = normalizeStationName(name);
  return escapeRegex(normalized || compressWhitespace(name).toLowerCase());
};

const normalizeStationName = (name) =>
  compressWhitespace(name.toLowerCase().replace(/\b(junction|jn\.?|central|city|terminal|charbagh|deccan)\b/g, ''));

const stationNamesMatch = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const normalizedLeft = normalizeStationName(left);
  const normalizedRight = normalizeStationName(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
};

const dedupeSequentialPoints = (points) => {
  if (!points.length) return [];
  const deduped = [];
  let previous = null;

  for (const point of points) {
    if (!previous || previous.lat !== point.lat || previous.lng !== point.lng) {
      deduped.push(point);
      previous = point;
    }
  }

  return deduped;
};

const samplePoints = (points, maxPoints) => {
  if (points.length <= maxPoints) return points;
  const sampled = [];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let index = 0; index < maxPoints; index += 1) {
    sampled.push(points[Math.round(index * step)]);
  }
  return dedupeSequentialPoints(sampled);
};

const getRouteStations = (train) => ({
  origin: db.stations.find((station) => station.code === train.origin),
  destination: db.stations.find((station) => station.code === train.destination),
});

const buildFallbackRoute = (train, originStation, destinationStation, source = 'fallback-geodesic') => ({
  train_id: train.id,
  train_number: train.train_number,
  train_name: train.name,
  origin_code: originStation.code,
  origin_name: originStation.name,
  destination_code: destinationStation.code,
  destination_name: destinationStation.name,
  route_name: `${originStation.name} - ${destinationStation.name}`,
  distance_km: round1(haversineKm({ lat: originStation.lat, lng: originStation.lng }, { lat: destinationStation.lat, lng: destinationStation.lng })),
  source,
  provider: source === 'osm-live' ? 'overpass' : 'local-geodesic',
  fetched_at: iso(now()),
  geometry: [
    { lat: originStation.lat, lng: originStation.lng },
    { lat: destinationStation.lat, lng: destinationStation.lng },
  ],
});

const extractOverpassGeometry = (elements) => {
  const points = [];
  for (const element of elements) {
    if (element.type !== 'way' || !Array.isArray(element.geometry)) continue;
    for (const point of element.geometry) {
      if (typeof point.lat !== 'number' || typeof point.lon !== 'number') continue;
      points.push({ lat: point.lat, lng: point.lon });
    }
  }
  return samplePoints(dedupeSequentialPoints(points), LIVE_ROUTE_MAX_POINTS);
};

const extractAllWayGeometries = (elements) =>
  elements
    .filter((element) => element.type === 'way' && Array.isArray(element.geometry))
    .map((element) =>
      element.geometry
        .filter((point) => typeof point.lat === 'number' && typeof point.lon === 'number')
        .map((point) => ({ lat: point.lat, lng: point.lon }))
    )
    .filter((geometry) => geometry.length > 1);

const extractRelationWayGeometries = (relation, elements) => {
  if (!relation || !Array.isArray(relation.members)) return [];

  const wayById = new Map(
    elements
      .filter((element) => element.type === 'way' && Array.isArray(element.geometry))
      .map((element) => [element.id, element])
  );

  const ways = [];
  for (const member of relation.members) {
    if (member.type !== 'way') continue;
    const way = wayById.get(member.ref);
    if (!way || !Array.isArray(way.geometry)) continue;

    const geometry = way.geometry
      .filter((point) => typeof point.lat === 'number' && typeof point.lon === 'number')
      .map((point) => ({ lat: point.lat, lng: point.lon }));
    if (geometry.length > 1) ways.push(geometry);
  }

  return ways;
};

const extractRelationGeometry = (relation, elements) => {
  const ways = extractRelationWayGeometries(relation, elements);
  const points = [];
  for (const way of ways) {
    for (const point of way) {
      points.push(point);
    }
  }

  return samplePoints(dedupeSequentialPoints(points), LIVE_ROUTE_MAX_POINTS);
};

const buildShortestRailPath = (wayGeometries, originStation, destinationStation) => {
  if (!wayGeometries.length) return null;

  const adjacency = new Map();
  const nodes = new Map();
  const keyForPoint = (point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;

  const addEdge = (from, to, weight) => {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push({ to, weight });
  };

  for (const geometry of wayGeometries) {
    for (let index = 1; index < geometry.length; index += 1) {
      const previous = geometry[index - 1];
      const current = geometry[index];
      const fromKey = keyForPoint(previous);
      const toKey = keyForPoint(current);
      nodes.set(fromKey, previous);
      nodes.set(toKey, current);

      const segmentDistance = haversineKm(previous, current);
      if (!Number.isFinite(segmentDistance) || segmentDistance <= 0 || segmentDistance > 20) continue;
      addEdge(fromKey, toKey, segmentDistance);
      addEdge(toKey, fromKey, segmentDistance);
    }
  }

  if (!nodes.size) return null;

  let startKey = null;
  let endKey = null;
  let startDistance = Number.POSITIVE_INFINITY;
  let endDistance = Number.POSITIVE_INFINITY;

  for (const [key, point] of nodes.entries()) {
    const distanceFromOrigin = haversineKm({ lat: originStation.lat, lng: originStation.lng }, point);
    if (distanceFromOrigin < startDistance) {
      startDistance = distanceFromOrigin;
      startKey = key;
    }

    const distanceFromDestination = haversineKm({ lat: destinationStation.lat, lng: destinationStation.lng }, point);
    if (distanceFromDestination < endDistance) {
      endDistance = distanceFromDestination;
      endKey = key;
    }
  }

  if (!startKey || !endKey) return null;

  const distances = new Map([[startKey, 0]]);
  const previous = new Map();
  const visited = new Set();
  const queue = [{ key: startKey, distance: 0 }];

  while (queue.length) {
    queue.sort((left, right) => left.distance - right.distance);
    const current = queue.shift();
    if (!current || visited.has(current.key)) continue;
    visited.add(current.key);

    if (current.key === endKey) break;
    const neighbors = adjacency.get(current.key) ?? [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor.to)) continue;
      const nextDistance = current.distance + neighbor.weight;
      if (nextDistance < (distances.get(neighbor.to) ?? Number.POSITIVE_INFINITY)) {
        distances.set(neighbor.to, nextDistance);
        previous.set(neighbor.to, current.key);
        queue.push({ key: neighbor.to, distance: nextDistance });
      }
    }
  }

  const finalDistance = distances.get(endKey);
  if (!Number.isFinite(finalDistance)) return null;

  const pathKeys = [];
  let cursor = endKey;
  while (cursor) {
    pathKeys.push(cursor);
    if (cursor === startKey) break;
    cursor = previous.get(cursor);
  }

  if (pathKeys[pathKeys.length - 1] !== startKey) return null;

  const geometry = samplePoints(
    dedupeSequentialPoints(pathKeys.reverse().map((key) => nodes.get(key)).filter(Boolean)),
    LIVE_ROUTE_MAX_POINTS
  );

  return {
    geometry,
    distance_km: round1(finalDistance),
    start_offset_km: round1(startDistance),
    end_offset_km: round1(endDistance),
  };
};

const postOverpass = async (endpoint, query) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_ROUTE_TIMEOUT_MS);

  try {
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
    } catch (error) {
      throw new Error(`Overpass request failed (${endpoint}): ${error?.message ?? error}`);
    }

    if (response.status === 429) {
      throw new Error(`Overpass rate limited (${endpoint})`);
    }
    if (!response.ok) {
      throw new Error(`Overpass responded with ${response.status} (${endpoint})`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const fetchLiveRouteFromOverpass = async (train, originStation, destinationStation) => {
  const originPattern = escapeOverpassPattern(stationQueryPattern(originStation.name));
  const destinationPattern = escapeOverpassPattern(stationQueryPattern(destinationStation.name));
  const trainPattern = escapeOverpassPattern(escapeRegex(compressWhitespace(train.name)));
  const trainNumberPattern = escapeOverpassPattern(escapeRegex(train.train_number));

  const discoveryQuery = `
[out:json][timeout:25];
(
  relation["route"="train"]["ref"~"${trainNumberPattern}"];
  relation["route"="train"]["name"~"${trainNumberPattern}"];
  relation["route"="train"]["name"~"${trainPattern}",i];
  relation["route"="train"]["from"~"${originPattern}",i]["to"~"${destinationPattern}",i];
  relation["route"="train"]["from"~"${destinationPattern}",i]["to"~"${originPattern}",i];
);
out tags ids;
`;

  let lastError = null;
  const staticDistanceKm = db.routes.find((route) => route.id === train.route_id)?.distance_km
    ?? round1(haversineKm(
      { lat: originStation.lat, lng: originStation.lng },
      { lat: destinationStation.lat, lng: destinationStation.lng }
    ));

  for (const endpoint of LIVE_ROUTE_OVERPASS_URLS) {
    try {
      const discoveryPayload = await postOverpass(endpoint, discoveryQuery);
      const discoveryElements = Array.isArray(discoveryPayload?.elements) ? discoveryPayload.elements : [];
      const relations = discoveryElements.filter((element) => element.type === 'relation');
      if (!relations.length) {
        lastError = new Error(`No route relation found (${endpoint})`);
        continue;
      }
      const directDistanceKm = haversineKm(
        { lat: originStation.lat, lng: originStation.lng },
        { lat: destinationStation.lat, lng: destinationStation.lng }
      );
      const maxAllowedDistanceKm = Math.max(directDistanceKm * 2.4, 2500);
      const minAllowedDistanceKm = directDistanceKm * 0.7;

      const scoreRelation = (candidate) => {
        let score = 0;
        const name = String(candidate.tags?.name ?? '').toLowerCase();
        const ref = String(candidate.tags?.ref ?? '').toLowerCase();
        if (name.includes(train.train_number) || ref.includes(train.train_number)) score += 50;
        if (stationNamesMatch(candidate.tags?.from, originStation.name) && stationNamesMatch(candidate.tags?.to, destinationStation.name)) score += 35;
        if (stationNamesMatch(candidate.tags?.from, destinationStation.name) && stationNamesMatch(candidate.tags?.to, originStation.name)) score += 30;
        if (name.includes(train.name.toLowerCase())) score += 20;
        return score;
      };

      const orderedRelations = [...relations]
        .map((candidate) => ({ candidate, score: scoreRelation(candidate) }))
        .sort((left, right) => right.score - left.score)
        .map((entry) => entry.candidate)
        .slice(0, 6);

      const bestMetadataRelation = orderedRelations[0] ?? null;

      for (const relation of orderedRelations) {
        try {
          const geometryQuery = `
[out:json][timeout:25];
relation(${relation.id});
(._;>;);
out geom;
`;
          const geometryPayload = await postOverpass(endpoint, geometryQuery);
          const elements = Array.isArray(geometryPayload?.elements) ? geometryPayload.elements : [];
          const geometryRelation =
            elements.find((element) => element.type === 'relation' && element.id === relation.id && Array.isArray(element.members))
            ?? relation;

          const relationWays = extractRelationWayGeometries(geometryRelation, elements);
          const relationShortestPath = buildShortestRailPath(relationWays, originStation, destinationStation);
          if (!relationShortestPath) {
            lastError = new Error(`No connected rail path for relation ${relation.id}`);
            continue;
          }

          if (relationShortestPath.start_offset_km > 120 || relationShortestPath.end_offset_km > 120) {
            lastError = new Error(`Relation ${relation.id} station offset too large (${relationShortestPath.start_offset_km}/${relationShortestPath.end_offset_km} km)`);
            continue;
          }

          const routeDistanceKm = relationShortestPath.distance_km;
          if (routeDistanceKm > maxAllowedDistanceKm || routeDistanceKm < minAllowedDistanceKm) {
            lastError = new Error(`Discarded implausible route geometry (${Math.round(routeDistanceKm)} km)`);
            continue;
          }

          return {
            ...buildFallbackRoute(train, originStation, destinationStation, 'osm-live'),
            route_name: geometryRelation?.tags?.name ?? `${originStation.name} - ${destinationStation.name}`,
            distance_km: round1(routeDistanceKm),
            provider: `overpass:${endpoint}`,
            geometry: relationShortestPath.geometry,
            fetched_at: iso(now()),
          };
        } catch (error) {
          lastError = error;
        }
      }

      if (bestMetadataRelation) {
        return {
          ...buildFallbackRoute(train, originStation, destinationStation, 'osm-live'),
          route_name: bestMetadataRelation?.tags?.name
            ?? bestMetadataRelation?.tags?.ref
            ?? `${originStation.name} - ${destinationStation.name}`,
          distance_km: round1(staticDistanceKm),
          provider: `overpass:${endpoint}`,
          geometry: [
            { lat: originStation.lat, lng: originStation.lng },
            { lat: destinationStation.lat, lng: destinationStation.lng },
          ],
          metadata_only: true,
          fetched_at: iso(now()),
        };
      }

      if (!lastError) {
        lastError = new Error(`No plausible route relation found (${endpoint})`);
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
};

const getCachedLiveRoute = (trainId) => {
  const cached = liveRouteCache.get(trainId);
  if (!cached) return null;
  if (cached.expires_at <= Date.now()) {
    liveRouteCache.delete(trainId);
    return null;
  }
  return cached.route;
};

const cacheLiveRoute = (trainId, route) => {
  liveRouteCache.set(trainId, {
    route,
    expires_at: Date.now() + LIVE_ROUTE_CACHE_TTL_MS,
  });
  return route;
};

const getFallbackRouteForTrain = (train) => {
  const { origin, destination } = getRouteStations(train);
  if (!origin || !destination) return null;
  return buildFallbackRoute(train, origin, destination);
};

const ensureLiveRouteForTrain = async (train, options = {}) => {
  const force = Boolean(options.force);
  if (!train) return null;

  if (!LIVE_ROUTE_ENABLED) {
    const fallbackRoute = getFallbackRouteForTrain(train);
    return fallbackRoute ? cacheLiveRoute(train.id, fallbackRoute) : null;
  }

  if (!force) {
    const cached = getCachedLiveRoute(train.id);
    if (cached) return cached;
  }

  if (liveRouteInFlight.has(train.id)) return liveRouteInFlight.get(train.id);

  const promise = (async () => {
    const { origin, destination } = getRouteStations(train);
    if (!origin || !destination) return null;

    try {
      const liveRoute = await fetchLiveRouteFromOverpass(train, origin, destination);
      if (liveRoute) return cacheLiveRoute(train.id, liveRoute);
    } catch (error) {
      console.warn(`[live-routes] failed for train ${train.train_number}: ${error?.message ?? error}`);
    }

    return cacheLiveRoute(train.id, buildFallbackRoute(train, origin, destination));
  })().finally(() => {
    liveRouteInFlight.delete(train.id);
  });

  liveRouteInFlight.set(train.id, promise);
  return promise;
};

const syncRoutesForTrains = async (trains, force) => {
  const routes = [];

  for (let index = 0; index < trains.length; index += 1) {
    const train = trains[index];
    const route = await ensureLiveRouteForTrain(train, { force });
    if (route) routes.push(route);
    if (index < trains.length - 1 && LIVE_ROUTE_SYNC_DELAY_MS > 0) {
      await sleep(LIVE_ROUTE_SYNC_DELAY_MS);
    }
  }

  return routes;
};

const getRouteSnapshotForTrain = (train) => {
  const cachedRoute = getCachedLiveRoute(train.id);
  if (cachedRoute) return cachedRoute;
  return getFallbackRouteForTrain(train);
};

const getLiveRouteHealth = () => {
  const nowMs = Date.now();
  const validEntries = [...liveRouteCache.values()].filter((entry) => entry.expires_at > nowMs);
  const synced = validEntries.filter((entry) => String(entry.route.source).startsWith('osm-live')).length;
  const lastSync = validEntries
    .map((entry) => entry.route.fetched_at)
    .sort((left, right) => new Date(left) - new Date(right))
    .at(-1) ?? null;

  return {
    enabled: LIVE_ROUTE_ENABLED,
    provider: 'overpass',
    synced,
    total: db.trains.length,
    last_sync: lastSync,
  };
};

const warmLiveRoutesInBackground = () => {
  if (!LIVE_ROUTE_ENABLED) return;
  void syncRoutesForTrains(db.trains, false).catch((error) => {
    console.warn(`[live-routes] warmup failed: ${error?.message ?? error}`);
  });
};

const normalizeTrainStatus = (value, fallback = 'on_time') => {
  const normalized = String(value ?? '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .trim();

  if (!normalized) return fallback;
  if (normalized.includes('cancel')) return 'cancelled';
  if (normalized.includes('delay') || normalized.includes('late')) return 'delayed';
  if (
    normalized === 'on_time' ||
    normalized === 'ontime' ||
    normalized === 'running' ||
    normalized === 'arrived' ||
    normalized === 'departed'
  ) {
    return 'on_time';
  }
  if (normalized === 'delayed' || normalized === 'cancelled') return normalized;
  return fallback;
};

const parseDelayMinutes = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();
    if (!normalized) return null;
    if (normalized.includes('on time')) return 0;
    const match = normalized.match(/-?\d+/);
    if (match) return Math.max(0, Number(match[0]));
  }
  return null;
};

const pickObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : null);

const firstString = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

const estimateCurrentStation = (train) => {
  const originStation = db.stations.find((station) => station.code === train.origin) ?? null;
  const destinationStation = db.stations.find((station) => station.code === train.destination) ?? null;

  if (!originStation && !destinationStation) return { code: null, name: null };

  const nowMs = Date.now();
  const departureMs = new Date(train.departure_time).getTime();
  const arrivalMs = new Date(train.arrival_time).getTime();

  if (nowMs <= departureMs) {
    return { code: originStation?.code ?? null, name: originStation?.name ?? null };
  }

  if (nowMs >= arrivalMs) {
    return { code: destinationStation?.code ?? originStation?.code ?? null, name: destinationStation?.name ?? originStation?.name ?? null };
  }

  const journeyProgress = (nowMs - departureMs) / Math.max(arrivalMs - departureMs, 1);
  if (journeyProgress < 0.5) {
    return { code: originStation?.code ?? null, name: originStation?.name ?? null };
  }

  return { code: destinationStation?.code ?? null, name: destinationStation?.name ?? null };
};

const buildInternalLiveStatus = (train, overrides = {}) => {
  const activeDisruptions = db.disruptions.filter((disruption) => disruption.train_id === train.id && disruption.status === 'active');

  let status = normalizeTrainStatus(train.status, 'on_time');
  let delayMinutes = status === 'delayed' ? 20 : 0;
  let message = 'Estimated from schedule and local disruption telemetry';

  for (const disruption of activeDisruptions) {
    if (disruption.type === 'cancellation' || disruption.severity === 'critical') {
      status = 'cancelled';
      delayMinutes = 0;
      message = 'Active cancellation/critical disruption detected';
      break;
    }

    if (disruption.type === 'delay') {
      status = 'delayed';
      delayMinutes = Math.max(
        delayMinutes,
        Number(disruption?.cascade_impact?.estimated_delay_min ?? 25)
      );
      message = 'Delay inferred from active disruption signal';
    }
  }

  const currentStation = estimateCurrentStation(train);

  return {
    train_id: train.id,
    train_number: train.train_number,
    train_name: train.name,
    status,
    delay_minutes: delayMinutes,
    source: 'internal-estimator',
    provider: 'local-ops-model',
    current_station_code: currentStation.code,
    current_station_name: currentStation.name,
    message,
    fetched_at: iso(now()),
    ...overrides,
  };
};

const liveStatusProvidersConfigured = () => {
  const providers = ['internal-estimator'];
  if (LIVE_STATUS_API_URL_TEMPLATE) providers.push('configured-api');
  if (LIVE_STATUS_RAPIDAPI_KEY && LIVE_STATUS_RAPIDAPI_HOST) providers.push('rapidapi-irctc');
  return providers;
};

const parseLiveStatusPayload = (payload, fallbackStatus) => {
  const root = pickObject(payload) ?? {};
  const data = pickObject(root.data) ?? root;
  const position = pickObject(data.position) ?? {};

  const statusValue =
    data.current_status
    ?? data.status
    ?? data.running_status
    ?? data.train_status
    ?? position.status
    ?? root.status;
  const delayValue =
    data.delay_minutes
    ?? data.delay
    ?? data.late_by
    ?? data.delay_min
    ?? position.delay
    ?? root.delay;

  const stationBlob = pickObject(data.current_station) ?? pickObject(data.station) ?? pickObject(position.station) ?? null;

  const currentStationCode = firstString(
    data.current_station_code,
    data.station_code,
    position.station_code,
    stationBlob?.code,
    stationBlob?.station_code,
  );
  const currentStationName = firstString(
    data.current_station_name,
    data.station_name,
    position.station_name,
    stationBlob?.name,
    stationBlob?.station_name,
  );

  return {
    status: normalizeTrainStatus(statusValue, normalizeTrainStatus(fallbackStatus, 'on_time')),
    delay_minutes: parseDelayMinutes(delayValue),
    current_station_code: currentStationCode,
    current_station_name: currentStationName,
    message: firstString(data.message, data.remark, root.message),
    external_timestamp: firstString(data.updated_at, data.last_updated, root.updated_at, root.last_updated),
  };
};

const buildConfiguredLiveStatusUrl = (train) => {
  const template = LIVE_STATUS_API_URL_TEMPLATE.trim();
  if (!template) return null;

  let url = template;
  const replacements = {
    '{trainNumber}': train.train_number,
    '{trainName}': train.name,
    '{origin}': train.origin,
    '{destination}': train.destination,
  };

  for (const [token, value] of Object.entries(replacements)) {
    url = url.replaceAll(token, encodeURIComponent(String(value)));
  }

  if (url === template && !/[?&](trainNo|trainNumber)=/i.test(url)) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}trainNumber=${encodeURIComponent(train.train_number)}`;
  }

  if (!/^https?:\/\//i.test(url)) return null;
  return url;
};

const fetchJsonWithTimeout = async (url, init = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_STATUS_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const fetchLiveStatusFromConfiguredApi = async (train) => {
  const url = buildConfiguredLiveStatusUrl(train);
  if (!url) return null;

  const headers = { accept: 'application/json' };
  if (LIVE_STATUS_API_KEY) {
    headers[LIVE_STATUS_API_AUTH_HEADER] = LIVE_STATUS_API_KEY;
  }

  const payload = await fetchJsonWithTimeout(url, { headers });
  const parsed = parseLiveStatusPayload(payload, train.status);
  const internal = buildInternalLiveStatus(train);

  return {
    ...internal,
    status: parsed.status,
    delay_minutes: parsed.delay_minutes ?? internal.delay_minutes,
    source: 'external-api',
    provider: 'configured-api',
    current_station_code: parsed.current_station_code ?? internal.current_station_code,
    current_station_name: parsed.current_station_name ?? internal.current_station_name,
    message: parsed.message ?? 'Fetched from configured live status API',
    fetched_at: iso(now()),
    external_timestamp: parsed.external_timestamp ?? null,
  };
};

const fetchLiveStatusFromRapidApi = async (train) => {
  if (!LIVE_STATUS_RAPIDAPI_KEY || !LIVE_STATUS_RAPIDAPI_HOST) return null;

  const url = `https://${LIVE_STATUS_RAPIDAPI_HOST}/api/v1/liveTrainStatus?trainNo=${encodeURIComponent(train.train_number)}&startDay=1`;
  const payload = await fetchJsonWithTimeout(url, {
    headers: {
      accept: 'application/json',
      'x-rapidapi-key': LIVE_STATUS_RAPIDAPI_KEY,
      'x-rapidapi-host': LIVE_STATUS_RAPIDAPI_HOST,
    },
  });

  const parsed = parseLiveStatusPayload(payload, train.status);
  const internal = buildInternalLiveStatus(train);

  return {
    ...internal,
    status: parsed.status,
    delay_minutes: parsed.delay_minutes ?? internal.delay_minutes,
    source: 'external-api',
    provider: 'rapidapi-irctc',
    current_station_code: parsed.current_station_code ?? internal.current_station_code,
    current_station_name: parsed.current_station_name ?? internal.current_station_name,
    message: parsed.message ?? 'Fetched from RapidAPI live status feed',
    fetched_at: iso(now()),
    external_timestamp: parsed.external_timestamp ?? null,
  };
};

const fetchLiveStatusFromProviders = async (train) => {
  const providers = [
    { name: 'configured-api', loader: fetchLiveStatusFromConfiguredApi },
    { name: 'rapidapi-irctc', loader: fetchLiveStatusFromRapidApi },
  ];

  for (const provider of providers) {
    try {
      const liveStatus = await provider.loader(train);
      if (liveStatus) return liveStatus;
    } catch (error) {
      console.warn(`[live-status] ${provider.name} failed for train ${train.train_number}: ${error?.message ?? error}`);
    }
  }

  return null;
};

const getCachedLiveStatus = (trainId) => {
  const cached = liveStatusCache.get(trainId);
  if (!cached) return null;
  if (cached.expires_at <= Date.now()) {
    liveStatusCache.delete(trainId);
    return null;
  }
  return cached.status;
};

const cacheLiveStatus = (trainId, status) => {
  liveStatusCache.set(trainId, {
    status,
    expires_at: Date.now() + LIVE_STATUS_CACHE_TTL_MS,
  });
  return status;
};

const ensureLiveStatusForTrain = async (train, options = {}) => {
  const force = Boolean(options.force);
  if (!train) return null;

  if (!force) {
    const cached = getCachedLiveStatus(train.id);
    if (cached) return cached;
  }

  if (liveStatusInFlight.has(train.id)) return liveStatusInFlight.get(train.id);

  const promise = (async () => {
    if (!LIVE_STATUS_ENABLED) {
      return cacheLiveStatus(train.id, buildInternalLiveStatus(train, {
        message: 'Live status APIs disabled; using internal estimator',
      }));
    }

    const external = await fetchLiveStatusFromProviders(train);
    if (external) return cacheLiveStatus(train.id, external);

    return cacheLiveStatus(train.id, buildInternalLiveStatus(train));
  })().finally(() => {
    liveStatusInFlight.delete(train.id);
  });

  liveStatusInFlight.set(train.id, promise);
  return promise;
};

const syncLiveStatusForTrains = async (trains, force) => {
  const statuses = [];

  for (let index = 0; index < trains.length; index += 1) {
    const train = trains[index];
    const status = await ensureLiveStatusForTrain(train, { force });
    if (status) statuses.push(status);
    if (index < trains.length - 1 && LIVE_STATUS_SYNC_DELAY_MS > 0) {
      await sleep(LIVE_STATUS_SYNC_DELAY_MS);
    }
  }

  return statuses;
};

const getLiveStatusSnapshotForTrain = (train) => {
  const cached = getCachedLiveStatus(train.id);
  if (cached) return cached;
  return buildInternalLiveStatus(train);
};

const summarizeLiveStatuses = (statuses) => {
  const summary = { on_time: 0, delayed: 0, cancelled: 0 };

  for (const statusRecord of statuses) {
    const normalized = normalizeTrainStatus(statusRecord?.status, 'on_time');
    if (normalized === 'cancelled') {
      summary.cancelled += 1;
    } else if (normalized === 'delayed') {
      summary.delayed += 1;
    } else {
      summary.on_time += 1;
    }
  }

  return summary;
};

const getLiveStatusHealth = () => {
  const nowMs = Date.now();
  const validEntries = [...liveStatusCache.values()].filter((entry) => entry.expires_at > nowMs);
  const snapshots = db.trains.map((train) => getLiveStatusSnapshotForTrain(train));
  const summary = summarizeLiveStatuses(snapshots);

  const lastSync = validEntries
    .map((entry) => entry.status.fetched_at)
    .sort((left, right) => new Date(left) - new Date(right))
    .at(-1) ?? null;

  return {
    enabled: LIVE_STATUS_ENABLED,
    providers: liveStatusProvidersConfigured(),
    cached: validEntries.length,
    synced_external: validEntries.filter((entry) => entry.status.source === 'external-api').length,
    total: db.trains.length,
    on_time: summary.on_time,
    delayed: summary.delayed,
    cancelled: summary.cancelled,
    last_sync: lastSync,
  };
};

const warmLiveStatusInBackground = () => {
  void syncLiveStatusForTrains(db.trains, false).catch((error) => {
    console.warn(`[live-status] warmup failed: ${error?.message ?? error}`);
  });
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const stationAlertLevelFromDensity = (density) => {
  if (density >= 0.85) return 'critical';
  if (density >= 0.7) return 'high';
  if (density >= 0.5) return 'medium';
  return 'low';
};

const normalizeCrowdDensity = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value <= 1) return clamp(Number(value.toFixed(2)), 0, 1);
  if (value <= 100) return clamp(Number((value / 100).toFixed(2)), 0, 1);
  return null;
};

const normalizeSentimentScore = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value <= 1) return clamp(Number(value.toFixed(2)), 0, 1);
  if (value <= 100) return clamp(Number((value / 100).toFixed(2)), 0, 1);
  return null;
};

const liveStationProvidersConfigured = () => {
  const providers = ['internal-estimator'];
  if (STATION_CROWD_API_URL_TEMPLATE) providers.push('configured-crowd-api');
  if (OPENWEATHER_API_KEY) providers.push('openweather');
  return providers;
};

const fetchStationJsonWithTimeout = async (url, init = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STATION_LIVE_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const buildStationCrowdApiUrl = (station) => {
  const template = STATION_CROWD_API_URL_TEMPLATE.trim();
  if (!template) return null;

  let url = template;
  const replacements = {
    '{stationCode}': station.code,
    '{stationName}': station.name,
    '{lat}': String(station.lat),
    '{lng}': String(station.lng),
  };

  for (const [token, value] of Object.entries(replacements)) {
    url = url.replaceAll(token, encodeURIComponent(value));
  }

  if (url === template && !/[?&](stationCode|code)=/i.test(url)) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}stationCode=${encodeURIComponent(station.code)}`;
  }

  if (!/^https?:\/\//i.test(url)) return null;
  return url;
};

const parseStationLivePayload = (payload, station) => {
  const root = pickObject(payload) ?? {};
  const data = pickObject(root.data) ?? root;

  const crowdDensity = normalizeCrowdDensity(
    data.crowd_density
    ?? data.occupancy_ratio
    ?? data.occupancy
    ?? data.occupancy_percent
    ?? data.density
    ?? root.crowd_density
  );

  const sentimentScore = normalizeSentimentScore(
    data.sentiment_score
    ?? data.sentiment
    ?? data.mood_score
    ?? root.sentiment_score
  );

  const alertLevelRaw = firstString(data.alert_level, data.alert, root.alert_level);
  const alertLevel =
    alertLevelRaw && ['low', 'medium', 'high', 'critical'].includes(alertLevelRaw.toLowerCase())
      ? alertLevelRaw.toLowerCase()
      : stationAlertLevelFromDensity(crowdDensity ?? 0.5);

  return {
    station_id: station.id,
    station_code: station.code,
    station_name: station.name,
    crowd_density: crowdDensity,
    sentiment_score: sentimentScore,
    alert_level: alertLevel,
    status_message: firstString(data.message, data.status_message, root.message) ?? null,
    external_timestamp: firstString(data.updated_at, data.last_updated, root.updated_at) ?? null,
  };
};

const fetchStationCrowdFromConfiguredApi = async (station) => {
  const url = buildStationCrowdApiUrl(station);
  if (!url) return null;

  const headers = { accept: 'application/json' };
  if (STATION_CROWD_API_KEY) {
    headers[STATION_CROWD_API_AUTH_HEADER] = STATION_CROWD_API_KEY;
  }

  const payload = await fetchStationJsonWithTimeout(url, { headers });
  const parsed = parseStationLivePayload(payload, station);
  if (parsed.crowd_density == null && parsed.sentiment_score == null) return null;

  return {
    ...parsed,
    source: 'external-api',
    provider: 'configured-crowd-api',
    fetched_at: iso(now()),
  };
};

const fetchStationWeatherFromOpenWeather = async (station) => {
  if (!OPENWEATHER_API_KEY) return null;

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(station.lat)}&lon=${encodeURIComponent(station.lng)}&units=${encodeURIComponent(OPENWEATHER_UNITS)}&appid=${encodeURIComponent(OPENWEATHER_API_KEY)}`;
  const payload = await fetchStationJsonWithTimeout(url);

  const temp = typeof payload?.main?.temp === 'number' ? Number(payload.main.temp.toFixed(1)) : null;
  const humidity = typeof payload?.main?.humidity === 'number' ? Math.round(payload.main.humidity) : null;
  const weatherCondition = firstString(
    payload?.weather?.[0]?.main,
    payload?.weather?.[0]?.description,
    payload?.weather_main
  );

  if (temp == null && humidity == null && !weatherCondition) return null;

  return {
    temperature_c: temp,
    humidity_percent: humidity,
    weather_condition: weatherCondition ?? null,
    provider: 'openweather',
  };
};

const buildInternalStationLiveSnapshot = (station, overrides = {}) => {
  const latestSentiment = [...db.sentiment_data]
    .filter((record) => record.station_id === station.id)
    .sort((left, right) => right.recorded_at - left.recorded_at)[0];

  const baseCrowd = latestSentiment?.crowd_density ?? 0.48;
  const baseSentiment = latestSentiment?.score ?? 0.62;
  const wave = Math.sin((Date.now() / 1000 + station.id * 37) / 180) * 0.06;
  const offset = Math.cos((Date.now() / 1000 + station.id * 23) / 95) * 0.02;

  const crowdDensity = clamp(Number((baseCrowd + wave + offset).toFixed(2)), 0.08, 0.99);
  const sentimentScore = clamp(Number((baseSentiment - wave * 0.55).toFixed(2)), 0.05, 0.99);
  const alertLevel = stationAlertLevelFromDensity(crowdDensity);

  return {
    station_id: station.id,
    station_code: station.code,
    station_name: station.name,
    crowd_density: crowdDensity,
    sentiment_score: sentimentScore,
    source: 'internal-estimator',
    provider: 'local-sensor-model',
    alert_level: alertLevel,
    status_message:
      alertLevel === 'critical'
        ? 'Critical crowding detected; entry throttling advised'
        : alertLevel === 'high'
          ? 'High crowd density detected; additional marshals advised'
          : 'Crowd conditions are stable',
    temperature_c: null,
    humidity_percent: null,
    weather_condition: null,
    fetched_at: iso(now()),
    ...overrides,
  };
};

const getCachedLiveStation = (stationId) => {
  const cached = liveStationCache.get(stationId);
  if (!cached) return null;
  if (cached.expires_at <= Date.now()) {
    liveStationCache.delete(stationId);
    return null;
  }
  return cached.snapshot;
};

const cacheLiveStation = (stationId, snapshot) => {
  liveStationCache.set(stationId, {
    snapshot,
    expires_at: Date.now() + STATION_LIVE_CACHE_TTL_MS,
  });
  return snapshot;
};

const ensureLiveStationSnapshot = async (station, options = {}) => {
  const force = Boolean(options.force);
  if (!station) return null;

  if (!force) {
    const cached = getCachedLiveStation(station.id);
    if (cached) return cached;
  }

  if (liveStationInFlight.has(station.id)) return liveStationInFlight.get(station.id);

  const promise = (async () => {
    const internal = buildInternalStationLiveSnapshot(station);
    if (!STATION_LIVE_ENABLED) {
      return cacheLiveStation(station.id, {
        ...internal,
        status_message: 'Live station APIs disabled; using local estimator',
      });
    }

    let crowdSnapshot = null;
    let weatherSnapshot = null;

    try {
      crowdSnapshot = await fetchStationCrowdFromConfiguredApi(station);
    } catch (error) {
      console.warn(`[station-live] configured crowd API failed for ${station.code}: ${error?.message ?? error}`);
    }

    try {
      weatherSnapshot = await fetchStationWeatherFromOpenWeather(station);
    } catch (error) {
      console.warn(`[station-live] weather API failed for ${station.code}: ${error?.message ?? error}`);
    }

    const providerParts = [];
    let source = internal.source;
    let provider = internal.provider;

    const merged = {
      ...internal,
      fetched_at: iso(now()),
    };

    if (crowdSnapshot) {
      merged.crowd_density = crowdSnapshot.crowd_density ?? merged.crowd_density;
      merged.sentiment_score = crowdSnapshot.sentiment_score ?? merged.sentiment_score;
      merged.alert_level = crowdSnapshot.alert_level ?? stationAlertLevelFromDensity(merged.crowd_density);
      merged.status_message = crowdSnapshot.status_message ?? merged.status_message;
      source = 'external-api';
      providerParts.push(crowdSnapshot.provider);
    }

    if (weatherSnapshot) {
      merged.temperature_c = weatherSnapshot.temperature_c;
      merged.humidity_percent = weatherSnapshot.humidity_percent;
      merged.weather_condition = weatherSnapshot.weather_condition;
      providerParts.push(weatherSnapshot.provider);
      if (source !== 'external-api') source = 'hybrid-live';
    }

    if (providerParts.length) {
      provider = providerParts.join('+');
    }

    return cacheLiveStation(station.id, {
      ...merged,
      source,
      provider,
    });
  })().finally(() => {
    liveStationInFlight.delete(station.id);
  });

  liveStationInFlight.set(station.id, promise);
  return promise;
};

const syncLiveStations = async (stations, force) => {
  const snapshots = [];

  for (let index = 0; index < stations.length; index += 1) {
    const station = stations[index];
    const snapshot = await ensureLiveStationSnapshot(station, { force });
    if (snapshot) snapshots.push(snapshot);

    if (index < stations.length - 1 && STATION_LIVE_SYNC_DELAY_MS > 0) {
      await sleep(STATION_LIVE_SYNC_DELAY_MS);
    }
  }

  return snapshots;
};

const getLiveStationSnapshot = (station) => {
  const cached = getCachedLiveStation(station.id);
  if (cached) return cached;
  return buildInternalStationLiveSnapshot(station);
};

const getStationLiveHealth = () => {
  const nowMs = Date.now();
  const validEntries = [...liveStationCache.values()].filter((entry) => entry.expires_at > nowMs);
  const snapshots = db.stations.map((station) => getLiveStationSnapshot(station));
  const highAlert = snapshots.filter((snapshot) => ['critical', 'high'].includes(String(snapshot.alert_level))).length;

  const lastSync = validEntries
    .map((entry) => entry.snapshot.fetched_at)
    .sort((left, right) => new Date(left) - new Date(right))
    .at(-1) ?? null;

  return {
    enabled: STATION_LIVE_ENABLED,
    providers: liveStationProvidersConfigured(),
    cached: validEntries.length,
    synced_external: validEntries.filter((entry) => ['external-api', 'hybrid-live'].includes(String(entry.snapshot.source))).length,
    total: db.stations.length,
    high_alert: highAlert,
    last_sync: lastSync,
  };
};

const buildStationResponse = (station, liveSnapshot) => {
  const live = liveSnapshot ?? getLiveStationSnapshot(station);
  return {
    ...station,
    crowd_density: live?.crowd_density ?? null,
    sentiment_score: live?.sentiment_score ?? null,
    alert_level: live?.alert_level ?? 'low',
    data_source: live?.source ?? 'internal-estimator',
    provider: live?.provider ?? 'local-sensor-model',
    status_message: live?.status_message ?? null,
    last_updated: live?.fetched_at ?? null,
    temperature_c: live?.temperature_c ?? null,
    humidity_percent: live?.humidity_percent ?? null,
    weather_condition: live?.weather_condition ?? null,
    live,
  };
};

const getNearbyStations = (lat, lng, limit = 5) => {
  const origin = { lat, lng };
  return db.stations
    .map((station) => {
      const live = getLiveStationSnapshot(station);
      return {
        ...buildStationResponse(station, live),
        distance_km: round1(haversineKm(origin, { lat: station.lat, lng: station.lng })),
      };
    })
    .sort((left, right) => left.distance_km - right.distance_km)
    .slice(0, limit);
};

const warmLiveStationsInBackground = () => {
  void syncLiveStations(db.stations, false).catch((error) => {
    console.warn(`[station-live] warmup failed: ${error?.message ?? error}`);
  });
};

const detectMongoMode = async () => {
  if (!MONGODB_URI) {
    runtimeMode = 'offline-memory';
    return;
  }

  const mongoClient = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await mongoClient.connect();
    await mongoClient.db('admin').command({ ping: 1 });
    runtimeMode = 'mongo-online';
  } catch {
    runtimeMode = 'offline-memory';
  } finally {
    try {
      await mongoClient.close();
    } catch {
      // ignore close errors
    }
  }
};

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'railmind-local-server',
    mode: runtimeMode,
    live_routes: getLiveRouteHealth(),
    live_status: getLiveStatusHealth(),
    station_live: getStationLiveHealth(),
  });
});

app.get('/railmind/dashboard', (_req, res) => {
  const latestByStation = new Map();
  for (const record of [...db.sentiment_data].sort((a, b) => b.recorded_at - a.recorded_at)) {
    if (!latestByStation.has(record.station_id)) latestByStation.set(record.station_id, record);
  }

  const network_nodes = db.stations.map((station) => {
    const liveStation = getLiveStationSnapshot(station);
    return {
      id: station.id,
      code: station.code,
      name: station.name,
      zone: station.zone,
      lat: station.lat,
      lng: station.lng,
      crowd_density: liveStation?.crowd_density ?? latestByStation.get(station.id)?.crowd_density ?? 0.5,
    };
  });

  const zoneToStation = {};
  for (const node of network_nodes) if (!zoneToStation[node.zone]) zoneToStation[node.zone] = node.id;

  const demandAvg = db.demand_forecasts.length
    ? db.demand_forecasts.reduce((sum, row) => sum + row.demand_score, 0) / db.demand_forecasts.length
    : 0.5;
  const demand_level = demandAvg > 0.75 ? 'high' : demandAvg > 0.5 ? 'medium' : 'low';

  const network_edges = db.trains
    .map((train) => {
      const originStation = db.stations.find((station) => station.code === train.origin);
      const destinationStation = db.stations.find((station) => station.code === train.destination);
      if (!originStation || !destinationStation) return null;

      const routeSnapshot = getRouteSnapshotForTrain(train);

      return {
        source: zoneToStation[originStation.zone] ?? originStation.id,
        target: zoneToStation[destinationStation.zone] ?? destinationStation.id,
        route_name: routeSnapshot?.route_name ?? train.name,
        distance_km: routeSnapshot?.distance_km ?? db.routes.find((route) => route.id === train.route_id)?.distance_km ?? 0,
        demand_level,
      };
    })
    .filter(Boolean);

  const total_coaches = db.coaches.length;
  const coaches_in_use = db.coaches.filter((coach) => coach.status === 'in_use').length;
  const liveRouteHealth = getLiveRouteHealth();
  const liveStatusHealth = getLiveStatusHealth();
  const stationLiveHealth = getStationLiveHealth();

  res.json({
    total_trains: db.trains.length,
    active_disruptions: db.disruptions.filter((disruption) => disruption.status === 'active').length,
    coaches_in_use,
    total_coaches,
    coaches_utilization_pct: total_coaches ? Math.round((coaches_in_use / total_coaches) * 100) : 0,
    forecast_accuracy_pct: 87,
    deadhead_reduction_pct: 34,
    network_nodes,
    network_edges,
    live_routes_enabled: liveRouteHealth.enabled,
    live_routes_synced: liveRouteHealth.synced,
    live_routes_total: liveRouteHealth.total,
    live_routes_last_sync: liveRouteHealth.last_sync,
    live_status_enabled: liveStatusHealth.enabled,
    live_status_on_time: liveStatusHealth.on_time,
    live_status_delayed: liveStatusHealth.delayed,
    live_status_cancelled: liveStatusHealth.cancelled,
    live_status_external_synced: liveStatusHealth.synced_external,
    live_status_last_sync: liveStatusHealth.last_sync,
    live_status_providers: liveStatusHealth.providers,
    station_live_enabled: stationLiveHealth.enabled,
    station_live_external_synced: stationLiveHealth.synced_external,
    station_live_high_alert: stationLiveHealth.high_alert,
    station_live_last_sync: stationLiveHealth.last_sync,
    station_live_providers: stationLiveHealth.providers,
  });
});

app.get('/railmind/trains', (_req, res) => {
  const trains = [...db.trains]
    .sort((left, right) => left.departure_time - right.departure_time)
    .map((train) => {
      const routeSnapshot = getRouteSnapshotForTrain(train);
      const liveStatusSnapshot = getLiveStatusSnapshotForTrain(train);

      return {
        ...train,
        status: liveStatusSnapshot?.status ?? train.status,
        departure_time: iso(train.departure_time),
        arrival_time: iso(train.arrival_time),
        coach_count: db.allocations.filter((allocation) => allocation.train_id === train.id).length,
        demand_score: db.demand_forecasts
          .filter((forecast) => forecast.train_id === train.id)
          .reduce((max, forecast) => Math.max(max, forecast.demand_score), 0) || null,
        route_name: routeSnapshot?.route_name ?? null,
        route_distance_km: routeSnapshot?.distance_km ?? db.routes.find((route) => route.id === train.route_id)?.distance_km ?? null,
        route_source: routeSnapshot?.source ?? 'fallback-geodesic',
        route_last_synced_at: routeSnapshot?.fetched_at ?? null,
        live_delay_minutes: liveStatusSnapshot?.delay_minutes ?? null,
        live_status_source: liveStatusSnapshot?.source ?? 'internal-estimator',
        live_status_provider: liveStatusSnapshot?.provider ?? 'local-ops-model',
        live_status_updated_at: liveStatusSnapshot?.fetched_at ?? null,
        live_status_message: liveStatusSnapshot?.message ?? null,
      };
    });
  res.json({ trains });
});

app.get('/railmind/trains/:id', async (req, res) => {
  const id = Number(req.params.id);
  const train = trainById(id);
  if (!train) return res.status(404).json({ message: 'Train not found' });

  const refresh = String(req.query.refresh ?? '').toLowerCase() === 'true';
  const [live_route, live_status] = await Promise.all([
    ensureLiveRouteForTrain(train, { force: refresh }),
    ensureLiveStatusForTrain(train, { force: refresh }),
  ]);

  const allocations = db.allocations
    .filter((allocation) => allocation.train_id === id)
    .sort((left, right) => left.position - right.position)
    .map((allocation) => {
      const coach = coachById(allocation.coach_id);
      if (!coach) return null;
      return {
        id: allocation.id,
        coach_number: coach.coach_number,
        coach_type: coach.coach_type,
        capacity: coach.capacity,
        position: allocation.position,
        allocated_reason: allocation.allocated_reason,
        shap_factors: allocation.shap_factors,
      };
    })
    .filter(Boolean);

  res.json({
    ...train,
    status: live_status?.status ?? train.status,
    departure_time: iso(train.departure_time),
    arrival_time: iso(train.arrival_time),
    allocations,
    live_route,
    live_status,
  });
});

app.get('/railmind/live-routes', async (req, res) => {
  const refresh = String(req.query.refresh ?? '').toLowerCase() === 'true';
  const trainId = req.query.trainId ? Number(req.query.trainId) : undefined;

  const trains = db.trains.filter((train) => (trainId ? train.id === trainId : true));
  const routes = refresh
    ? await syncRoutesForTrains(trains, true)
    : trains.map((train) => getRouteSnapshotForTrain(train)).filter(Boolean);
  const liveRouteHealth = getLiveRouteHealth();

  res.json({
    enabled: liveRouteHealth.enabled,
    provider: liveRouteHealth.provider,
    synced: liveRouteHealth.synced,
    total: trains.length,
    last_sync: liveRouteHealth.last_sync,
    routes: routes.filter(Boolean),
  });
});

app.post('/railmind/live-routes/sync', async (req, res) => {
  const trainId = req.body?.trainId ? Number(req.body.trainId) : undefined;
  const trains = db.trains.filter((train) => (trainId ? train.id === trainId : true));
  const routes = await syncRoutesForTrains(trains, true);
  const synced = routes.filter((route) => String(route?.source ?? '').startsWith('osm-live')).length;
  const liveRouteHealth = getLiveRouteHealth();

  res.json({
    success: true,
    provider: 'overpass',
    synced,
    total: trains.length,
    last_sync: liveRouteHealth.last_sync,
    routes: routes.filter(Boolean),
  });
});

app.get('/railmind/live-status', async (req, res) => {
  const refresh = String(req.query.refresh ?? '').toLowerCase() === 'true';
  const trainId = req.query.trainId ? Number(req.query.trainId) : undefined;

  const trains = db.trains.filter((train) => (trainId ? train.id === trainId : true));
  const statuses = refresh
    ? await syncLiveStatusForTrains(trains, true)
    : trains.map((train) => getLiveStatusSnapshotForTrain(train)).filter(Boolean);

  const summary = summarizeLiveStatuses(statuses);
  const liveStatusHealth = getLiveStatusHealth();

  res.json({
    enabled: liveStatusHealth.enabled,
    providers: liveStatusHealth.providers,
    synced_external: liveStatusHealth.synced_external,
    total: trains.length,
    last_sync: liveStatusHealth.last_sync,
    summary,
    statuses,
  });
});

app.post('/railmind/live-status/sync', async (req, res) => {
  const trainId = req.body?.trainId ? Number(req.body.trainId) : undefined;
  const trains = db.trains.filter((train) => (trainId ? train.id === trainId : true));
  const statuses = await syncLiveStatusForTrains(trains, true);
  const summary = summarizeLiveStatuses(statuses);
  const liveStatusHealth = getLiveStatusHealth();

  res.json({
    success: true,
    providers: liveStatusHealth.providers,
    synced_external: statuses.filter((status) => status.source === 'external-api').length,
    total: trains.length,
    last_sync: liveStatusHealth.last_sync,
    summary,
    statuses,
  });
});

app.get('/railmind/stations', async (req, res) => {
  const refresh = String(req.query.refresh ?? '').toLowerCase() === 'true';
  if (refresh) {
    await syncLiveStations(db.stations, true);
  }

  res.json({
    stations: db.stations.map((station) => buildStationResponse(station, getLiveStationSnapshot(station))),
    live_health: getStationLiveHealth(),
  });
});

app.get('/railmind/stations/live', async (req, res) => {
  const refresh = String(req.query.refresh ?? '').toLowerCase() === 'true';
  const stationId = req.query.stationId ? Number(req.query.stationId) : undefined;
  const stations = db.stations.filter((station) => (stationId ? station.id === stationId : true));

  if (refresh) {
    await syncLiveStations(stations, true);
  }

  const stationSnapshots = stations
    .map((station) => buildStationResponse(station, getLiveStationSnapshot(station)));

  const summary = {
    critical: stationSnapshots.filter((station) => station.alert_level === 'critical').length,
    high: stationSnapshots.filter((station) => station.alert_level === 'high').length,
    medium: stationSnapshots.filter((station) => station.alert_level === 'medium').length,
    low: stationSnapshots.filter((station) => station.alert_level === 'low').length,
  };

  const stationLiveHealth = getStationLiveHealth();

  res.json({
    enabled: stationLiveHealth.enabled,
    providers: stationLiveHealth.providers,
    synced_external: stationLiveHealth.synced_external,
    total: stationSnapshots.length,
    last_sync: stationLiveHealth.last_sync,
    summary,
    stations: stationSnapshots,
  });
});

app.post('/railmind/stations/live/sync', async (req, res) => {
  const stationId = req.body?.stationId ? Number(req.body.stationId) : undefined;
  const stations = db.stations.filter((station) => (stationId ? station.id === stationId : true));
  const snapshots = await syncLiveStations(stations, true);

  const summary = {
    critical: snapshots.filter((snapshot) => snapshot.alert_level === 'critical').length,
    high: snapshots.filter((snapshot) => snapshot.alert_level === 'high').length,
    medium: snapshots.filter((snapshot) => snapshot.alert_level === 'medium').length,
    low: snapshots.filter((snapshot) => snapshot.alert_level === 'low').length,
  };

  const stationLiveHealth = getStationLiveHealth();

  res.json({
    success: true,
    providers: stationLiveHealth.providers,
    synced_external: snapshots.filter((snapshot) => ['external-api', 'hybrid-live'].includes(String(snapshot.source))).length,
    total: snapshots.length,
    last_sync: stationLiveHealth.last_sync,
    summary,
    stations: stations.map((station) => buildStationResponse(station, getLiveStationSnapshot(station))),
  });
});

app.get('/railmind/stations/nearby', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const limit = clamp(Number(req.query.limit ?? 5) || 5, 1, 20);
  const refresh = String(req.query.refresh ?? '').toLowerCase() === 'true';

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ message: 'lat and lng query parameters are required numbers' });
  }

  if (refresh) {
    await syncLiveStations(db.stations, true);
  }

  const nearby = getNearbyStations(lat, lng, limit);
  res.json({
    location: { lat, lng },
    limit,
    total: nearby.length,
    nearby,
  });
});

app.get('/railmind/stations/:id', async (req, res) => {
  const id = Number(req.params.id);
  const station = stationById(id);
  if (!station) return res.status(404).json({ message: 'Station not found' });

  const refresh = String(req.query.refresh ?? '').toLowerCase() === 'true';
  const liveStation = refresh
    ? await ensureLiveStationSnapshot(station, { force: true })
    : getLiveStationSnapshot(station);

  const upcoming_trains = db.trains
    .filter((train) => (train.origin === station.code || train.destination === station.code) && train.departure_time > now())
    .sort((left, right) => left.departure_time - right.departure_time)
    .slice(0, 5)
    .map((train) => {
      const liveStatus = getLiveStatusSnapshotForTrain(train);
      return {
        id: train.id,
        train_number: train.train_number,
        name: train.name,
        departure_time: iso(train.departure_time),
        status: liveStatus?.status ?? train.status,
      };
    });

  res.json({
    ...buildStationResponse(station, liveStation),
    upcoming_trains,
  });
});

app.get('/railmind/disruptions', (_req, res) => {
  const disruptions = [...db.disruptions]
    .sort((left, right) => {
      const lp = left.status === 'active' ? 0 : 1;
      const rp = right.status === 'active' ? 0 : 1;
      if (lp !== rp) return lp - rp;
      return right.detected_at - left.detected_at;
    })
    .map((disruption) => {
      const train = trainById(disruption.train_id);
      return {
        ...disruption,
        detected_at: iso(disruption.detected_at),
        resolved_at: disruption.resolved_at ? iso(disruption.resolved_at) : null,
        train_number: train?.train_number ?? null,
        train_name: train?.name ?? null,
      };
    });

  res.json({ disruptions });
});

app.post('/railmind/disruptions/:id/resolve', (req, res) => {
  const id = Number(req.params.id);
  const disruption = db.disruptions.find((row) => row.id === id);
  if (!disruption) return res.status(404).json({ message: 'Disruption not found' });
  if (disruption.status === 'resolved') return res.json({ success: false, message: 'Disruption already resolved' });
  disruption.status = 'resolved';
  disruption.resolved_at = now();
  res.json({ success: true, message: 'Disruption resolved and auto-suggestions applied' });
});

app.post('/railmind/disruptions/inject', (req, res) => {
  const { trainId, type, severity } = req.body;
  db.counters.disruptions += 1;
  const disruptionId = db.counters.disruptions;
  const coaches_to_reassign = Math.floor(Math.random() * 4 + 1);
  db.disruptions.push({
    id: disruptionId,
    train_id: Number(trainId),
    type,
    severity,
    detected_at: now(),
    resolved_at: null,
    cascade_impact: {
      affected_trains: [Number(trainId)],
      estimated_delay_min: type === 'delay' ? Math.floor(Math.random() * 120 + 30) : 0,
      coaches_to_reassign,
    },
    status: 'active',
    auto_suggestions: [{ type: 'coach_rescue', from_train: Number(trainId) === 1 ? 2 : 1, to_train: Number(trainId), coaches: coaches_to_reassign, rationale: `Automated recommendation to rebalance ${coaches_to_reassign} coaches` }],
  });
  res.json({ success: true, disruptionId });
});

app.get('/railmind/forecasts', (req, res) => {
  const trainId = req.query.trainId ? Number(req.query.trainId) : undefined;
  const filtered = db.demand_forecasts
    .filter((forecast) => (trainId ? forecast.train_id === trainId : true))
    .sort((left, right) => left.forecast_time - right.forecast_time)
    .map((forecast) => {
      const train = trainById(forecast.train_id);
      const station = stationById(forecast.station_id);
      return {
        ...forecast,
        forecast_time: iso(forecast.forecast_time),
        created_at: iso(forecast.created_at),
        train_number: train?.train_number ?? null,
        train_name: train?.name ?? null,
        station_code: station?.code ?? null,
        station_name: station?.name ?? null,
      };
    });

  res.json({ forecasts: filtered });
});

app.post('/railmind/forecasts/generate', (_req, res) => {
  let count = 0;
  for (const train of db.trains) {
    for (let slot = 1; slot <= 3; slot += 1) {
      const station = db.stations[slot % Math.min(db.stations.length, 3)];
      db.counters.demand_forecasts += 1;
      db.demand_forecasts.push({
        id: db.counters.demand_forecasts,
        train_id: train.id,
        station_id: station.id,
        forecast_time: new Date(Date.now() + slot * 6 * 3600_000),
        demand_score: Math.min(0.99, Math.random() * 0.4 + 0.3),
        confidence: Number((Math.random() * 0.15 + 0.8).toFixed(2)),
        factors: {
          event_boost: Number((Math.random() * 0.3).toFixed(3)),
          historical: Number((Math.random() * 0.3 + 0.3).toFixed(3)),
          weather: Number((Math.random() * 0.15 + 0.05).toFixed(3)),
          time_of_day: Number((Math.random() * 0.1 + 0.15).toFixed(3)),
        },
        created_at: now(),
      });
      count += 1;
    }
  }
  res.json({ success: true, forecasts_generated: count });
});

app.get('/railmind/events', (_req, res) => {
  const events = [...db.events]
    .sort((left, right) => left.start_date - right.start_date)
    .map((event) => ({
      ...event,
      start_date: iso(event.start_date),
      end_date: iso(event.end_date),
      impact_score: Math.min(1.0, event.expected_attendance / 5000000),
    }));
  res.json({ events });
});

app.get('/railmind/rake-transfers', (_req, res) => {
  const rake_transfers = [...db.rake_transfers]
    .sort((left, right) => left.scheduled_at - right.scheduled_at)
    .map((row) => ({ ...row, scheduled_at: iso(row.scheduled_at) }));
  res.json({ rake_transfers });
});

app.post('/railmind/rake-transfers/:id/approve', (req, res) => {
  const id = Number(req.params.id);
  const transfer = db.rake_transfers.find((row) => row.id === id);
  if (!transfer) return res.status(404).json({ message: 'Rake transfer not found' });
  if (transfer.status !== 'proposed') return res.json({ success: false, message: 'Transfer is not in proposed state' });
  transfer.status = 'approved';
  res.json({ success: true, message: 'Rake transfer approved and scheduled for execution' });
});

app.post('/railmind/rake-transfers/optimize', (_req, res) => {
  const available = db.coaches.filter((coach) => coach.status === 'available').slice(0, 9);
  if (available.length < 3) return res.json({ success: false, proposals_created: 0, total_savings_km: 0 });

  const proposals = [
    { from_zone: 'Central', to_zone: 'South', coach_ids: available.slice(0, 3).map((coach) => coach.id), estimated_savings_km: 720.5 },
    { from_zone: 'East', to_zone: 'West', coach_ids: available.slice(3, 6).map((coach) => coach.id), estimated_savings_km: 1340.0 },
  ];

  let created = 0;
  let total_savings_km = 0;
  for (const proposal of proposals) {
    if (!proposal.coach_ids.length) continue;
    db.counters.rake_transfers += 1;
    db.rake_transfers.push({
      id: db.counters.rake_transfers,
      from_zone: proposal.from_zone,
      to_zone: proposal.to_zone,
      coach_ids: proposal.coach_ids,
      scheduled_at: new Date(Date.now() + 8 * 3600_000),
      status: 'proposed',
      estimated_savings_km: proposal.estimated_savings_km,
    });
    created += 1;
    total_savings_km += proposal.estimated_savings_km;
  }

  res.json({ success: true, proposals_created: created, total_savings_km });
});

app.get('/railmind/sentiment', (_req, res) => {
  const sentiment = [...db.sentiment_data]
    .sort((left, right) => right.recorded_at - left.recorded_at)
    .slice(0, 50)
    .map((row) => ({
      ...row,
      recorded_at: iso(row.recorded_at),
      station_code: stationById(row.station_id)?.code ?? null,
      station_name: stationById(row.station_id)?.name ?? null,
    }));
  res.json({ sentiment });
});

app.post('/railmind/sentiment/simulate', (_req, res) => {
  const sources = ['cctv', 'social', 'kiosk'];
  const messages = [
    'Crowd density nominal. Passenger flow smooth.',
    'Elevated crowd levels detected near entry points.',
    'Kiosk feedback: passengers request more coaches.',
    'Social media: positive travel experience reported.',
    'CCTV alert: platform overcrowding imminent.',
  ];

  for (const station of db.stations) {
    db.counters.sentiment_data += 1;
    db.sentiment_data.push({
      id: db.counters.sentiment_data,
      station_id: station.id,
      source: sources[Math.floor(Math.random() * sources.length)],
      score: Number((Math.random() * 0.6 + 0.2).toFixed(2)),
      crowd_density: Number((Math.random() * 0.7 + 0.15).toFixed(2)),
      message: messages[Math.floor(Math.random() * messages.length)],
      recorded_at: now(),
    });
  }

  res.json({ success: true, records_created: db.stations.length });
});

app.get('/railmind/allocations', (req, res) => {
  const trainId = req.query.trainId ? Number(req.query.trainId) : undefined;
  const allocations = [...db.allocations]
    .filter((row) => (trainId ? row.train_id === trainId : true))
    .sort((left, right) => left.train_id - right.train_id || left.position - right.position)
    .map((allocation) => ({
      ...allocation,
      allocated_at: iso(allocation.allocated_at),
      train_number: trainById(allocation.train_id)?.train_number ?? null,
      coach_number: coachById(allocation.coach_id)?.coach_number ?? null,
      coach_type: coachById(allocation.coach_id)?.coach_type ?? null,
    }));
  res.json({ allocations });
});

app.post('/railmind/allocations/:id/override', (req, res) => {
  const id = Number(req.params.id);
  const { officialName, reason, newCoachId } = req.body;
  const allocation = db.allocations.find((row) => row.id === id);
  if (!allocation) return res.status(404).json({ message: 'Allocation not found' });

  const previous_state = { coach_id: allocation.coach_id, shap_factors: allocation.shap_factors };
  allocation.coach_id = Number(newCoachId);
  allocation.override_by = officialName;
  allocation.override_reason = reason;

  const coach = coachById(Number(newCoachId));
  if (coach) {
    coach.status = 'in_use';
    coach.current_train_id = allocation.train_id;
  }

  db.counters.override_logs += 1;
  db.override_logs.push({
    id: db.counters.override_logs,
    allocation_id: id,
    official_name: officialName,
    reason,
    previous_state,
    new_state: { coach_id: Number(newCoachId), override_by: officialName, reason },
    created_at: now(),
  });

  res.json({ success: true, message: 'Allocation overridden and logged in audit trail' });
});

app.get('/railmind/coaches', (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const coaches = [...db.coaches]
    .filter((coach) => (status ? coach.status === status : true))
    .sort((left, right) => left.coach_type.localeCompare(right.coach_type) || left.coach_number.localeCompare(right.coach_number))
    .map((coach) => ({
      ...coach,
      train_number: coach.current_train_id ? trainById(coach.current_train_id)?.train_number ?? null : null,
      station_name: coach.current_station_id ? stationById(coach.current_station_id)?.name ?? null : null,
    }));
  res.json({ coaches });
});

app.post('/railmind/coaches/reallocate', (req, res) => {
  const { trainId, reason } = req.body;
  const priority = { AC1: 1, AC2: 2, AC3: 3, SL: 4 };
  const available = [...db.coaches]
    .filter((coach) => coach.status === 'available')
    .sort((left, right) => (priority[left.coach_type] ?? 5) - (priority[right.coach_type] ?? 5) || left.id - right.id)
    .slice(0, 5);

  if (!available.length) return res.json({ success: false, allocations_created: 0, message: 'No available coaches found' });

  let position = 1;
  for (const coach of available) {
    db.counters.allocations += 1;
    db.allocations.push({
      id: db.counters.allocations,
      train_id: Number(trainId),
      coach_id: coach.id,
      position,
      allocated_at: now(),
      allocated_reason: reason,
      shap_factors: {
        demand_forecast: Number((Math.random() * 0.2 + 0.25).toFixed(2)),
        event_impact: Number((Math.random() * 0.15 + 0.15).toFixed(2)),
        historical_avg: Number((Math.random() * 0.15 + 0.2).toFixed(2)),
        weather: Number((Math.random() * 0.1 + 0.08).toFixed(2)),
        sentiment: Number((Math.random() * 0.05 + 0.05).toFixed(2)),
      },
      override_by: null,
      override_reason: null,
    });
    coach.status = 'in_use';
    coach.current_train_id = Number(trainId);
    position += 1;
  }

  res.json({ success: true, allocations_created: available.length, message: `Allocated ${available.length} coaches to train ${trainId}` });
});

app.post('/railmind/seed', (_req, res) => {
  res.json({ success: true, message: 'Seed endpoint available in offline mode (in-memory data already initialized)' });
});

await detectMongoMode();
warmLiveRoutesInBackground();
warmLiveStatusInBackground();
warmLiveStationsInBackground();

app.listen(PORT, () => {
  console.log(`RailMind local backend running on http://localhost:${PORT} (${runtimeMode})`);
});
