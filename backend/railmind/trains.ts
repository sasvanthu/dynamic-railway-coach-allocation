import { api, APIError } from "encore.dev/api";
import { getCollection, toIsoString } from "../db";

interface Train {
  id: number;
  train_number: string;
  name: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  status: string;
  route_id: number | null;
  coach_count: number;
  demand_score: number | null;
}

interface ListTrainsResponse {
  trains: Train[];
}

export const listTrains = api<void, ListTrainsResponse>(
  { expose: true, method: "GET", path: "/railmind/trains" },
  async () => {
    const trainsCol = await getCollection<Omit<Train, "coach_count" | "demand_score" | "departure_time" | "arrival_time"> & {
      departure_time: Date | string;
      arrival_time: Date | string;
    }>("trains");
    const allocationsCol = await getCollection<{ train_id: number }>("allocations");
    const forecastsCol = await getCollection<{ train_id: number; demand_score: number }>("demand_forecasts");

    const trainsRaw = await trainsCol.find({}).sort({ departure_time: 1 }).toArray();
    const allocationCounts = await allocationsCol
      .aggregate<{ _id: number; count: number }>([
        { $group: { _id: "$train_id", count: { $sum: 1 } } },
      ])
      .toArray();
    const maxDemand = await forecastsCol
      .aggregate<{ _id: number; max_demand: number }>([
        { $group: { _id: "$train_id", max_demand: { $max: "$demand_score" } } },
      ])
      .toArray();

    const allocationMap = new Map(allocationCounts.map((entry) => [entry._id, entry.count]));
    const demandMap = new Map(maxDemand.map((entry) => [entry._id, entry.max_demand]));

    const trains: Train[] = trainsRaw.map((train) => ({
      ...train,
      departure_time: toIsoString(train.departure_time) ?? new Date().toISOString(),
      arrival_time: toIsoString(train.arrival_time) ?? new Date().toISOString(),
      coach_count: allocationMap.get(train.id) ?? 0,
      demand_score: demandMap.get(train.id) ?? null,
    }));

    return { trains };
  }
);

interface CoachAllocation {
  id: number;
  coach_number: string;
  coach_type: string;
  capacity: number;
  position: number;
  allocated_reason: string;
  shap_factors: Record<string, number>;
}

interface TrainDetail {
  id: number;
  train_number: string;
  name: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  status: string;
  route_id: number | null;
  allocations: CoachAllocation[];
}

interface GetTrainParams {
  id: number;
}

export const getTrain = api<GetTrainParams, TrainDetail>(
  { expose: true, method: "GET", path: "/railmind/trains/:id" },
  async ({ id }) => {
    const trainsCol = await getCollection<Omit<TrainDetail, "allocations" | "departure_time" | "arrival_time"> & {
      departure_time: Date | string;
      arrival_time: Date | string;
    }>("trains");
    const allocationsCol = await getCollection<{
      id: number;
      train_id: number;
      coach_id: number;
      position: number;
      allocated_reason: string;
      shap_factors: Record<string, number>;
    }>("allocations");
    const coachesCol = await getCollection<{ id: number; coach_number: string; coach_type: string; capacity: number }>("coaches");

    const train = await trainsCol.findOne({ id });
    if (!train) throw APIError.notFound("Train not found");

    const allocationsRaw = await allocationsCol.find({ train_id: id }).sort({ position: 1 }).toArray();
    const coachIds = allocationsRaw.map((allocation) => allocation.coach_id);
    const coaches = coachIds.length
      ? await coachesCol.find({ id: { $in: coachIds } }).toArray()
      : [];
    const coachMap = new Map(coaches.map((coach) => [coach.id, coach]));

    const allocations: CoachAllocation[] = allocationsRaw
      .map((allocation) => {
        const coach = coachMap.get(allocation.coach_id);
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
      .filter((allocation): allocation is CoachAllocation => allocation !== null);

    return {
      ...train,
      departure_time: toIsoString(train.departure_time) ?? new Date().toISOString(),
      arrival_time: toIsoString(train.arrival_time) ?? new Date().toISOString(),
      allocations,
    };
  }
);
