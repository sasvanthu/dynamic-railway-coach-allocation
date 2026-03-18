CREATE TABLE stations (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  zone TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  platform_count INTEGER NOT NULL DEFAULT 4
);

CREATE TABLE routes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  zone_from TEXT NOT NULL,
  zone_to TEXT NOT NULL,
  distance_km DOUBLE PRECISION NOT NULL,
  intermediate_stations JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE trains (
  id SERIAL PRIMARY KEY,
  train_number TEXT NOT NULL,
  name TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_time TIMESTAMPTZ NOT NULL,
  arrival_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'on_time',
  route_id INTEGER REFERENCES routes(id)
);

CREATE TABLE coaches (
  id SERIAL PRIMARY KEY,
  coach_number TEXT NOT NULL,
  coach_type TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  current_train_id INTEGER REFERENCES trains(id),
  current_station_id INTEGER REFERENCES stations(id)
);

CREATE TABLE allocations (
  id SERIAL PRIMARY KEY,
  train_id INTEGER REFERENCES trains(id),
  coach_id INTEGER REFERENCES coaches(id),
  position INTEGER NOT NULL,
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  allocated_reason TEXT,
  shap_factors JSONB,
  override_by TEXT,
  override_reason TEXT
);

CREATE TABLE demand_forecasts (
  id SERIAL PRIMARY KEY,
  train_id INTEGER REFERENCES trains(id),
  station_id INTEGER REFERENCES stations(id),
  forecast_time TIMESTAMPTZ NOT NULL,
  demand_score DOUBLE PRECISION NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  factors JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE disruptions (
  id SERIAL PRIMARY KEY,
  train_id INTEGER REFERENCES trains(id),
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  cascade_impact JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  auto_suggestions JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE sentiment_data (
  id SERIAL PRIMARY KEY,
  station_id INTEGER REFERENCES stations(id),
  source TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  crowd_density DOUBLE PRECISION NOT NULL,
  message TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rake_transfers (
  id SERIAL PRIMARY KEY,
  from_zone TEXT NOT NULL,
  to_zone TEXT NOT NULL,
  coach_ids JSONB NOT NULL DEFAULT '[]',
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  estimated_savings_km DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE override_logs (
  id SERIAL PRIMARY KEY,
  allocation_id INTEGER REFERENCES allocations(id),
  official_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  previous_state JSONB NOT NULL DEFAULT '{}',
  new_state JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  location TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  expected_attendance INTEGER NOT NULL DEFAULT 0,
  affected_stations JSONB NOT NULL DEFAULT '[]'
);
