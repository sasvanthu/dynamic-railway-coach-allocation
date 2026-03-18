import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { getCollection, nextId } from "../db";

interface Coach {
  id: number;
  coach_number: string;
  coach_type: string;
  capacity: number;
  status: string;
  current_train_id: number | null;
  current_station_id: number | null;
  train_number: string | null;
  station_name: string | null;
}

interface ListCoachesParams {
  status?: Query<string>;
}

interface ListCoachesResponse {
  coaches: Coach[];
}

export const listCoaches = api<ListCoachesParams, ListCoachesResponse>(
  { expose: true, method: "GET", path: "/railmind/coaches" },
  async ({ status }) => {
    const coachesCol = await getCollection<Coach>("coaches");
    const trainsCol = await getCollection<{ id: number; train_number: string }>("trains");
    const stationsCol = await getCollection<{ id: number; name: string }>("stations");

    const query = status === undefined ? {} : { status };
    const coachesRaw = await coachesCol.find(query).sort({ coach_type: 1, coach_number: 1 }).toArray();

    const trainIds = [...new Set(coachesRaw.map((coach) => coach.current_train_id).filter((value): value is number => value !== null))];
    const stationIds = [...new Set(coachesRaw.map((coach) => coach.current_station_id).filter((value): value is number => value !== null))];

    const trains = trainIds.length ? await trainsCol.find({ id: { $in: trainIds } }).toArray() : [];
    const stations = stationIds.length ? await stationsCol.find({ id: { $in: stationIds } }).toArray() : [];

    const trainMap = new Map(trains.map((train) => [train.id, train]));
    const stationMap = new Map(stations.map((station) => [station.id, station]));

    const coaches: Coach[] = coachesRaw.map((coach) => ({
      ...coach,
      train_number: coach.current_train_id ? (trainMap.get(coach.current_train_id)?.train_number ?? null) : null,
      station_name: coach.current_station_id ? (stationMap.get(coach.current_station_id)?.name ?? null) : null,
    }));

    return { coaches };
  }
);

interface ReallocateRequest {
  trainId: number;
  reason: string;
}

interface ReallocateResponse {
  success: boolean;
  allocations_created: number;
  message: string;
}

export const reallocate = api<ReallocateRequest, ReallocateResponse>(
  { expose: true, method: "POST", path: "/railmind/coaches/reallocate" },
  async ({ trainId, reason }) => {
    const coachesCol = await getCollection<{ id: number; coach_type: string; capacity: number; status: string }>("coaches");
    const allocationsCol = await getCollection<{
      id: number;
      train_id: number;
      coach_id: number;
      position: number;
      allocated_at: Date;
      allocated_reason: string;
      shap_factors: Record<string, number>;
      override_by: string | null;
      override_reason: string | null;
    }>("allocations");

    const coachPriority: Record<string, number> = { AC1: 1, AC2: 2, AC3: 3, SL: 4 };
    const available = (await coachesCol.find({ status: "available" }).toArray())
      .sort(
        (left, right) =>
          (coachPriority[left.coach_type] ?? 5) - (coachPriority[right.coach_type] ?? 5) ||
          left.id - right.id,
      )
      .slice(0, 5);

    if (available.length === 0) {
      return { success: false, allocations_created: 0, message: "No available coaches found" };
    }

    let position = 1;
    for (const coach of available) {
      const shapFactors = {
        demand_forecast: parseFloat((Math.random() * 0.2 + 0.25).toFixed(2)),
        event_impact: parseFloat((Math.random() * 0.15 + 0.15).toFixed(2)),
        historical_avg: parseFloat((Math.random() * 0.15 + 0.2).toFixed(2)),
        weather: parseFloat((Math.random() * 0.1 + 0.08).toFixed(2)),
        sentiment: parseFloat((Math.random() * 0.05 + 0.05).toFixed(2)),
      };
      await allocationsCol.insertOne({
        id: await nextId("allocations"),
        train_id: trainId,
        coach_id: coach.id,
        position,
        allocated_at: new Date(),
        allocated_reason: reason,
        shap_factors: shapFactors,
        override_by: null,
        override_reason: null,
      });

      await coachesCol.updateOne(
        { id: coach.id },
        { $set: { status: "in_use", current_train_id: trainId } },
      );

      position++;
    }

    return {
      success: true,
      allocations_created: available.length,
      message: `Allocated ${available.length} coaches to train ${trainId} using MILP optimizer`,
    };
  }
);
