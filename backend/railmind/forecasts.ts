import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { getCollection, nextId, toIsoString } from "../db";

interface Forecast {
  id: number;
  train_id: number;
  station_id: number;
  forecast_time: string;
  demand_score: number;
  confidence: number;
  factors: Record<string, number>;
  created_at: string;
  train_number: string | null;
  train_name: string | null;
  station_code: string | null;
  station_name: string | null;
}

interface ListForecastsParams {
  trainId?: Query<number>;
}

interface ListForecastsResponse {
  forecasts: Forecast[];
}

export const listForecasts = api<ListForecastsParams, ListForecastsResponse>(
  { expose: true, method: "GET", path: "/railmind/forecasts" },
  async ({ trainId }) => {
    const forecastsCol = await getCollection<Omit<Forecast, "forecast_time" | "created_at" | "train_number" | "train_name" | "station_code" | "station_name"> & {
      forecast_time: Date | string;
      created_at: Date | string;
    }>("demand_forecasts");
    const trainsCol = await getCollection<{ id: number; train_number: string; name: string }>("trains");
    const stationsCol = await getCollection<{ id: number; code: string; name: string }>("stations");

    const query = trainId === undefined ? {} : { train_id: trainId };
    const forecastsRaw = await forecastsCol.find(query).sort({ forecast_time: 1 }).toArray();

    const trainIds = [...new Set(forecastsRaw.map((forecast) => forecast.train_id))];
    const stationIds = [...new Set(forecastsRaw.map((forecast) => forecast.station_id))];

    const trains = trainIds.length ? await trainsCol.find({ id: { $in: trainIds } }).toArray() : [];
    const stations = stationIds.length ? await stationsCol.find({ id: { $in: stationIds } }).toArray() : [];
    const trainMap = new Map(trains.map((train) => [train.id, train]));
    const stationMap = new Map(stations.map((station) => [station.id, station]));

    const forecasts: Forecast[] = forecastsRaw.map((forecast) => {
      const train = trainMap.get(forecast.train_id);
      const station = stationMap.get(forecast.station_id);
      return {
        ...forecast,
        forecast_time: toIsoString(forecast.forecast_time) ?? new Date().toISOString(),
        created_at: toIsoString(forecast.created_at) ?? new Date().toISOString(),
        train_number: train?.train_number ?? null,
        train_name: train?.name ?? null,
        station_code: station?.code ?? null,
        station_name: station?.name ?? null,
      };
    });

    return { forecasts };
  }
);

interface GenerateForecastsResponse {
  success: boolean;
  forecasts_generated: number;
}

export const generateForecasts = api<void, GenerateForecastsResponse>(
  { expose: true, method: "POST", path: "/railmind/forecasts/generate" },
  async () => {
    const trainsCol = await getCollection<{ id: number }>("trains");
    const stationsCol = await getCollection<{ id: number }>("stations");
    const eventsCol = await getCollection<{ expected_attendance: number; start_date: Date }>("events");
    const forecastsCol = await getCollection<{
      id: number;
      train_id: number;
      station_id: number;
      forecast_time: Date;
      demand_score: number;
      confidence: number;
      factors: Record<string, number>;
      created_at: Date;
    }>("demand_forecasts");

    const trains = await trainsCol.find({}).project<{ id: number }>({ id: 1, _id: 0 }).toArray();
    const stations = await stationsCol.find({}).limit(3).project<{ id: number }>({ id: 1, _id: 0 }).toArray();
    const events = await eventsCol
      .find({ start_date: { $gt: new Date() } })
      .sort({ start_date: 1 })
      .limit(3)
      .project<{ expected_attendance: number }>({ expected_attendance: 1, _id: 0 })
      .toArray();

    if (stations.length === 0 || trains.length === 0) {
      return { success: true, forecasts_generated: 0 };
    }

    let count = 0;
    for (const train of trains) {
      for (let slot = 1; slot <= 3; slot++) {
        const station = stations[slot % stations.length];
        const baseScore = Math.random() * 0.4 + 0.3;
        const eventBoost = events.length > 0 ? (events[0].expected_attendance / 10000000) * 0.4 : 0;
        const demandScore = Math.min(0.99, baseScore + eventBoost * Math.random());
        const confidence = parseFloat((Math.random() * 0.15 + 0.8).toFixed(2));
        const factors = {
          event_boost: parseFloat((eventBoost * Math.random()).toFixed(3)),
          historical: parseFloat((Math.random() * 0.3 + 0.3).toFixed(3)),
          weather: parseFloat((Math.random() * 0.15 + 0.05).toFixed(3)),
          time_of_day: parseFloat((Math.random() * 0.1 + 0.15).toFixed(3)),
        };
        const hours = slot * 6;

        await forecastsCol.insertOne({
          id: await nextId("demand_forecasts"),
          train_id: train.id,
          station_id: station.id,
          forecast_time: new Date(Date.now() + hours * 60 * 60 * 1000),
          demand_score: demandScore,
          confidence,
          factors,
          created_at: new Date(),
        });

        count++;
      }
    }

    return { success: true, forecasts_generated: count };
  }
);
