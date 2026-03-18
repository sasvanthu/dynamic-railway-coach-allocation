import { api } from "encore.dev/api";
import { getCollection, nextId, toIsoString } from "../db";

interface SentimentRecord {
  id: number;
  station_id: number;
  source: string;
  score: number;
  crowd_density: number;
  message: string;
  recorded_at: string;
  station_code: string | null;
  station_name: string | null;
}

interface ListSentimentResponse {
  sentiment: SentimentRecord[];
}

export const listSentiment = api<void, ListSentimentResponse>(
  { expose: true, method: "GET", path: "/railmind/sentiment" },
  async () => {
    const sentimentCol = await getCollection<Omit<SentimentRecord, "recorded_at" | "station_code" | "station_name"> & { recorded_at: Date | string }>("sentiment_data");
    const stationsCol = await getCollection<{ id: number; code: string; name: string }>("stations");

    const rows = await sentimentCol.find({}).sort({ recorded_at: -1 }).limit(50).toArray();
    const stationIds = [...new Set(rows.map((row) => row.station_id))];
    const stations = stationIds.length ? await stationsCol.find({ id: { $in: stationIds } }).toArray() : [];
    const stationMap = new Map(stations.map((station) => [station.id, station]));

    const sentiment: SentimentRecord[] = rows.map((row) => {
      const station = stationMap.get(row.station_id);
      return {
        ...row,
        recorded_at: toIsoString(row.recorded_at) ?? new Date().toISOString(),
        station_code: station?.code ?? null,
        station_name: station?.name ?? null,
      };
    });

    return { sentiment };
  }
);

interface SimulateSentimentResponse {
  success: boolean;
  records_created: number;
}

export const simulateSentiment = api<void, SimulateSentimentResponse>(
  { expose: true, method: "POST", path: "/railmind/sentiment/simulate" },
  async () => {
    const stationsCol = await getCollection<{ id: number; name: string }>("stations");
    const sentimentCol = await getCollection<{
      id: number;
      station_id: number;
      source: string;
      score: number;
      crowd_density: number;
      message: string;
      recorded_at: Date;
    }>("sentiment_data");

    const stations = await stationsCol.find({}).project<{ id: number; name: string }>({ id: 1, name: 1, _id: 0 }).toArray();
    const sources = ["cctv", "social", "kiosk"];
    const messages = [
      "Crowd density nominal. Passenger flow smooth.",
      "Elevated crowd levels detected near entry points.",
      "Kiosk feedback: passengers request more coaches.",
      "Social media: positive travel experience reported.",
      "CCTV alert: platform overcrowding imminent.",
      "Crowd dispersing after train departure.",
      "Festival crowd detected. Surge protocols recommended.",
      "Normal operations. No anomalies detected.",
    ];

    let count = 0;
    for (const station of stations) {
      const source = sources[Math.floor(Math.random() * sources.length)];
      const score = parseFloat((Math.random() * 0.6 + 0.2).toFixed(2));
      const crowdDensity = parseFloat((Math.random() * 0.7 + 0.15).toFixed(2));
      const message = messages[Math.floor(Math.random() * messages.length)];
      await sentimentCol.insertOne({
        id: await nextId("sentiment_data"),
        station_id: station.id,
        source,
        score,
        crowd_density: crowdDensity,
        message,
        recorded_at: new Date(),
      });
      count++;
    }

    return { success: true, records_created: count };
  }
);
