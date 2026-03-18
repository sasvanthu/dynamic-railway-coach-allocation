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
  res.json({ ok: true, service: 'railmind-local-server', mode: runtimeMode });
});

app.get('/railmind/dashboard', (_req, res) => {
  const latestByStation = new Map();
  for (const record of [...db.sentiment_data].sort((a, b) => b.recorded_at - a.recorded_at)) {
    if (!latestByStation.has(record.station_id)) latestByStation.set(record.station_id, record);
  }

  const network_nodes = db.stations.map((station) => ({
    id: station.id,
    code: station.code,
    name: station.name,
    zone: station.zone,
    lat: station.lat,
    lng: station.lng,
    crowd_density: latestByStation.get(station.id)?.crowd_density ?? 0.5,
  }));

  const zoneToStation = {};
  for (const node of network_nodes) if (!zoneToStation[node.zone]) zoneToStation[node.zone] = node.id;

  const demandAvg = db.demand_forecasts.length
    ? db.demand_forecasts.reduce((sum, row) => sum + row.demand_score, 0) / db.demand_forecasts.length
    : 0.5;
  const demand_level = demandAvg > 0.75 ? 'high' : demandAvg > 0.5 ? 'medium' : 'low';

  const network_edges = db.routes.map((route) => ({
    source: zoneToStation[route.zone_from] ?? network_nodes[0]?.id ?? 1,
    target: zoneToStation[route.zone_to] ?? network_nodes[1]?.id ?? 2,
    route_name: route.name,
    distance_km: route.distance_km,
    demand_level,
  }));

  const total_coaches = db.coaches.length;
  const coaches_in_use = db.coaches.filter((coach) => coach.status === 'in_use').length;

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
  });
});

app.get('/railmind/trains', (_req, res) => {
  const trains = [...db.trains]
    .sort((left, right) => left.departure_time - right.departure_time)
    .map((train) => ({
      ...train,
      departure_time: iso(train.departure_time),
      arrival_time: iso(train.arrival_time),
      coach_count: db.allocations.filter((allocation) => allocation.train_id === train.id).length,
      demand_score: db.demand_forecasts
        .filter((forecast) => forecast.train_id === train.id)
        .reduce((max, forecast) => Math.max(max, forecast.demand_score), 0) || null,
    }));
  res.json({ trains });
});

app.get('/railmind/trains/:id', (req, res) => {
  const id = Number(req.params.id);
  const train = trainById(id);
  if (!train) return res.status(404).json({ message: 'Train not found' });

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

  res.json({ ...train, departure_time: iso(train.departure_time), arrival_time: iso(train.arrival_time), allocations });
});

app.get('/railmind/stations', (_req, res) => {
  const latestByStation = new Map();
  for (const record of [...db.sentiment_data].sort((a, b) => b.recorded_at - a.recorded_at)) {
    if (!latestByStation.has(record.station_id)) latestByStation.set(record.station_id, record);
  }

  res.json({
    stations: db.stations.map((station) => ({
      ...station,
      crowd_density: latestByStation.get(station.id)?.crowd_density ?? null,
      sentiment_score: latestByStation.get(station.id)?.score ?? null,
    })),
  });
});

app.get('/railmind/stations/:id', (req, res) => {
  const id = Number(req.params.id);
  const station = stationById(id);
  if (!station) return res.status(404).json({ message: 'Station not found' });

  const sentiment = [...db.sentiment_data].filter((record) => record.station_id === id).sort((a, b) => b.recorded_at - a.recorded_at)[0];
  const upcoming_trains = db.trains
    .filter((train) => (train.origin === station.code || train.destination === station.code) && train.departure_time > now())
    .sort((left, right) => left.departure_time - right.departure_time)
    .slice(0, 5)
    .map((train) => ({
      id: train.id,
      train_number: train.train_number,
      name: train.name,
      departure_time: iso(train.departure_time),
      status: train.status,
    }));

  res.json({
    ...station,
    crowd_density: sentiment?.crowd_density ?? null,
    sentiment_score: sentiment?.score ?? null,
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

app.listen(PORT, () => {
  console.log(`RailMind local backend running on http://localhost:${PORT} (${runtimeMode})`);
});
