import { api, APIError } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { getCollection, nextId, toIsoString } from "../db";

interface Allocation {
  id: number;
  train_id: number;
  coach_id: number;
  position: number;
  allocated_at: string;
  allocated_reason: string | null;
  shap_factors: Record<string, number> | null;
  override_by: string | null;
  override_reason: string | null;
  train_number: string | null;
  coach_number: string | null;
  coach_type: string | null;
}

interface ListAllocationsParams {
  trainId?: Query<number>;
}

interface ListAllocationsResponse {
  allocations: Allocation[];
}

export const listAllocations = api<ListAllocationsParams, ListAllocationsResponse>(
  { expose: true, method: "GET", path: "/railmind/allocations" },
  async ({ trainId }) => {
    const allocationsCol = await getCollection<Allocation>("allocations");
    const trainsCol = await getCollection<{ id: number; train_number: string }>("trains");
    const coachesCol = await getCollection<{ id: number; coach_number: string; coach_type: string }>("coaches");

    const query = trainId === undefined ? {} : { train_id: trainId };
    const allocationsRaw = await allocationsCol.find(query).sort({ train_id: 1, position: 1 }).toArray();

    const trainIds = [...new Set(allocationsRaw.map((allocation) => allocation.train_id))];
    const coachIds = [...new Set(allocationsRaw.map((allocation) => allocation.coach_id))];

    const trains = trainIds.length
      ? await trainsCol.find({ id: { $in: trainIds } }).toArray()
      : [];
    const coaches = coachIds.length
      ? await coachesCol.find({ id: { $in: coachIds } }).toArray()
      : [];

    const trainMap = new Map(trains.map((train) => [train.id, train]));
    const coachMap = new Map(coaches.map((coach) => [coach.id, coach]));

    const allocations: Allocation[] = allocationsRaw.map((allocation) => {
      const train = trainMap.get(allocation.train_id);
      const coach = coachMap.get(allocation.coach_id);
      return {
        ...allocation,
        allocated_at: toIsoString(allocation.allocated_at) ?? new Date().toISOString(),
        train_number: train?.train_number ?? null,
        coach_number: coach?.coach_number ?? null,
        coach_type: coach?.coach_type ?? null,
      };
    });

    return { allocations };
  }
);

interface OverrideAllocationParams {
  id: number;
}

interface OverrideAllocationRequest {
  officialName: string;
  reason: string;
  newCoachId: number;
}

interface OverrideAllocationResponse {
  success: boolean;
  message: string;
}

export const overrideAllocation = api<OverrideAllocationParams & OverrideAllocationRequest, OverrideAllocationResponse>(
  { expose: true, method: "POST", path: "/railmind/allocations/:id/override" },
  async ({ id, officialName, reason, newCoachId }) => {
    const allocationsCol = await getCollection<{ id: number; train_id: number; coach_id: number; shap_factors: unknown }>("allocations");
    const coachesCol = await getCollection<{ id: number; status: string; current_train_id: number | null }>("coaches");
    const overrideLogsCol = await getCollection<{
      id: number;
      allocation_id: number;
      official_name: string;
      reason: string;
      previous_state: Record<string, unknown>;
      new_state: Record<string, unknown>;
      created_at: Date;
    }>("override_logs");

    const allocation = await allocationsCol.findOne({ id });
    if (!allocation) throw APIError.notFound("Allocation not found");

    const previousState = { coach_id: allocation.coach_id, shap_factors: allocation.shap_factors };
    const newState = { coach_id: newCoachId, override_by: officialName, reason };

    await allocationsCol.updateOne(
      { id },
      { $set: { coach_id: newCoachId, override_by: officialName, override_reason: reason } },
    );

    await overrideLogsCol.insertOne({
      id: await nextId("override_logs"),
      allocation_id: id,
      official_name: officialName,
      reason,
      previous_state: previousState,
      new_state: newState,
      created_at: new Date(),
    });

    await coachesCol.updateOne(
      { id: newCoachId },
      { $set: { status: "in_use", current_train_id: allocation.train_id } },
    );

    return { success: true, message: "Allocation overridden and logged in audit trail" };
  }
);
