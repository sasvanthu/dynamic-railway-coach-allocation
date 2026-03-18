import { api, APIError } from "encore.dev/api";
import { getCollection, nextId, toIsoString } from "../db";

interface Disruption {
  id: number;
  train_id: number;
  type: string;
  severity: string;
  detected_at: string;
  resolved_at: string | null;
  cascade_impact: Record<string, unknown>;
  status: string;
  auto_suggestions: unknown[];
  train_number: string | null;
  train_name: string | null;
}

interface ListDisruptionsResponse {
  disruptions: Disruption[];
}

export const listDisruptions = api<void, ListDisruptionsResponse>(
  { expose: true, method: "GET", path: "/railmind/disruptions" },
  async () => {
    const disruptionsCol = await getCollection<Omit<Disruption, "detected_at" | "resolved_at" | "train_number" | "train_name"> & {
      detected_at: Date | string;
      resolved_at: Date | string | null;
    }>("disruptions");
    const trainsCol = await getCollection<{ id: number; train_number: string; name: string }>("trains");

    const disruptionsRaw = await disruptionsCol.find({}).toArray();
    disruptionsRaw.sort((left, right) => {
      const leftPriority = left.status === "active" ? 0 : 1;
      const rightPriority = right.status === "active" ? 0 : 1;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return new Date(right.detected_at).getTime() - new Date(left.detected_at).getTime();
    });

    const trainIds = [...new Set(disruptionsRaw.map((disruption) => disruption.train_id))];
    const trains = trainIds.length ? await trainsCol.find({ id: { $in: trainIds } }).toArray() : [];
    const trainMap = new Map(trains.map((train) => [train.id, train]));

    const disruptions: Disruption[] = disruptionsRaw.map((disruption) => {
      const train = trainMap.get(disruption.train_id);
      return {
        ...disruption,
        detected_at: toIsoString(disruption.detected_at) ?? new Date().toISOString(),
        resolved_at: toIsoString(disruption.resolved_at),
        train_number: train?.train_number ?? null,
        train_name: train?.name ?? null,
      };
    });

    return { disruptions };
  }
);

interface ResolveDisruptionParams {
  id: number;
}

interface ResolveDisruptionResponse {
  success: boolean;
  message: string;
}

export const resolveDisruption = api<ResolveDisruptionParams, ResolveDisruptionResponse>(
  { expose: true, method: "POST", path: "/railmind/disruptions/:id/resolve" },
  async ({ id }) => {
    const disruptionsCol = await getCollection<{ id: number; status: string }>("disruptions");
    const disruption = await disruptionsCol.findOne({ id });
    if (!disruption) throw APIError.notFound("Disruption not found");
    if (disruption.status === "resolved") {
      return { success: false, message: "Disruption already resolved" };
    }
    await disruptionsCol.updateOne({ id }, { $set: { status: "resolved", resolved_at: new Date() } });
    return { success: true, message: "Disruption resolved and auto-suggestions applied" };
  }
);

interface InjectDisruptionRequest {
  trainId: number;
  type: string;
  severity: string;
}

interface InjectDisruptionResponse {
  success: boolean;
  disruptionId: number;
}

export const injectDisruption = api<InjectDisruptionRequest, InjectDisruptionResponse>(
  { expose: true, method: "POST", path: "/railmind/disruptions/inject" },
  async ({ trainId, type, severity }) => {
    const disruptionsCol = await getCollection<{
      id: number;
      train_id: number;
      type: string;
      severity: string;
      detected_at: Date;
      resolved_at: Date | null;
      cascade_impact: Record<string, unknown>;
      status: string;
      auto_suggestions: unknown[];
    }>("disruptions");

    const affectedTrains = [trainId];
    const delayMin = type === "delay" ? Math.floor(Math.random() * 120 + 30) : 0;
    const coachesToReassign = Math.floor(Math.random() * 4 + 1);
    const cascadeImpact = {
      affected_trains: affectedTrains,
      estimated_delay_min: delayMin,
      coaches_to_reassign: coachesToReassign,
    };
    const autoSuggestions = [
      {
        type: "coach_rescue",
        from_train: trainId === 1 ? 2 : 1,
        to_train: trainId,
        coaches: coachesToReassign,
        rationale: `Automated MILP recommendation: redistribute ${coachesToReassign} coaches to affected train to manage ${type}`,
      },
    ];
    const disruptionId = await nextId("disruptions");
    await disruptionsCol.insertOne({
      id: disruptionId,
      train_id: trainId,
      type,
      severity,
      detected_at: new Date(),
      resolved_at: null,
      cascade_impact: cascadeImpact,
      status: "active",
      auto_suggestions: autoSuggestions,
    });

    return { success: true, disruptionId };
  }
);
