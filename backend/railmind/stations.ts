import { api, APIError } from "encore.dev/api";
import { getCollection, toIsoString } from "../db";

interface Station {
  id: number;
  code: string;
  name: string;
  zone: string;
  lat: number;
  lng: number;
  platform_count: number;
  crowd_density: number | null;
  sentiment_score: number | null;
}

interface ListStationsResponse {
  stations: Station[];
}

export const listStations = api<void, ListStationsResponse>(
  { expose: true, method: "GET", path: "/railmind/stations" },
  async () => {
    const stationsCol = await getCollection<Omit<Station, "crowd_density" | "sentiment_score">>("stations");
    const sentimentCol = await getCollection<{ station_id: number; crowd_density: number; score: number; recorded_at: Date | string }>("sentiment_data");

    const stations = await stationsCol.find({}).sort({ id: 1 }).toArray();

    const sentimentRows = await sentimentCol
      .aggregate<{ station_id: number; crowd_density: number; score: number }>([
        { $sort: { recorded_at: -1 } },
        { $group: { _id: "$station_id", crowd_density: { $first: "$crowd_density" }, score: { $first: "$score" } } },
        { $project: { _id: 0, station_id: "$_id", crowd_density: 1, score: 1 } },
      ])
      .toArray();

    const sentimentMap = new Map(sentimentRows.map((row) => [row.station_id, row]));

    return {
      stations: stations.map((station) => ({
        ...station,
        crowd_density: sentimentMap.get(station.id)?.crowd_density ?? null,
        sentiment_score: sentimentMap.get(station.id)?.score ?? null,
      })),
    };
  }
);

interface UpcomingTrain {
  id: number;
  train_number: string;
  name: string;
  departure_time: string;
  status: string;
}

interface StationDetail {
  id: number;
  code: string;
  name: string;
  zone: string;
  lat: number;
  lng: number;
  platform_count: number;
  crowd_density: number | null;
  sentiment_score: number | null;
  upcoming_trains: UpcomingTrain[];
}

interface GetStationParams {
  id: number;
}

export const getStation = api<GetStationParams, StationDetail>(
  { expose: true, method: "GET", path: "/railmind/stations/:id" },
  async ({ id }) => {
    const stationsCol = await getCollection<Omit<StationDetail, "upcoming_trains" | "crowd_density" | "sentiment_score">>("stations");
    const sentimentCol = await getCollection<{ station_id: number; crowd_density: number; score: number; recorded_at: Date | string }>("sentiment_data");
    const trainsCol = await getCollection<{
      id: number;
      train_number: string;
      name: string;
      departure_time: Date | string;
      status: string;
      origin: string;
      destination: string;
    }>("trains");

    const station = await stationsCol.findOne({ id });
    if (!station) throw APIError.notFound("Station not found");

    const latestSentiment = await sentimentCol.find({ station_id: id }).sort({ recorded_at: -1 }).limit(1).toArray();
    const sentiment = latestSentiment[0];

    const upcomingRaw = await trainsCol
      .find({
        $and: [
          { $or: [{ origin: station.code }, { destination: station.code }] },
          { departure_time: { $gt: new Date() } },
        ],
      })
      .sort({ departure_time: 1 })
      .limit(5)
      .toArray();

    const upcoming_trains: UpcomingTrain[] = upcomingRaw.map((train) => ({
      id: train.id,
      train_number: train.train_number,
      name: train.name,
      departure_time: toIsoString(train.departure_time) ?? new Date().toISOString(),
      status: train.status,
    }));

    return {
      ...station,
      crowd_density: sentiment?.crowd_density ?? null,
      sentiment_score: sentiment?.score ?? null,
      upcoming_trains,
    };
  }
);
