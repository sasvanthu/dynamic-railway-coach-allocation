import { api, APIError } from "encore.dev/api";
import { getCollection, nextId, toIsoString } from "../db";

interface RakeTransfer {
  id: number;
  from_zone: string;
  to_zone: string;
  coach_ids: number[];
  scheduled_at: string;
  status: string;
  estimated_savings_km: number;
}

interface ListRakeTransfersResponse {
  rake_transfers: RakeTransfer[];
}

export const listRakeTransfers = api<void, ListRakeTransfersResponse>(
  { expose: true, method: "GET", path: "/railmind/rake-transfers" },
  async () => {
    const rakeTransfersCol = await getCollection<Omit<RakeTransfer, "scheduled_at"> & { scheduled_at: Date | string }>("rake_transfers");
    const raw = await rakeTransfersCol.find({}).sort({ scheduled_at: 1 }).toArray();
    const rake_transfers: RakeTransfer[] = raw.map((transfer) => ({
      ...transfer,
      scheduled_at: toIsoString(transfer.scheduled_at) ?? new Date().toISOString(),
    }));
    return { rake_transfers };
  }
);

interface ApproveRakeTransferParams {
  id: number;
}

interface ApproveRakeTransferResponse {
  success: boolean;
  message: string;
}

export const approveRakeTransfer = api<ApproveRakeTransferParams, ApproveRakeTransferResponse>(
  { expose: true, method: "POST", path: "/railmind/rake-transfers/:id/approve" },
  async ({ id }) => {
    const rakeTransfersCol = await getCollection<{ id: number; status: string }>("rake_transfers");
    const transfer = await rakeTransfersCol.findOne({ id });
    if (!transfer) throw APIError.notFound("Rake transfer not found");
    if (transfer.status !== "proposed") {
      return { success: false, message: "Transfer is not in proposed state" };
    }
    await rakeTransfersCol.updateOne({ id }, { $set: { status: "approved" } });
    return { success: true, message: "Rake transfer approved and scheduled for execution" };
  }
);

interface OptimizeRakeTransfersResponse {
  success: boolean;
  proposals_created: number;
  total_savings_km: number;
}

export const optimizeRakeTransfers = api<void, OptimizeRakeTransfersResponse>(
  { expose: true, method: "POST", path: "/railmind/rake-transfers/optimize" },
  async () => {
    const coachesCol = await getCollection<{ id: number; status: string }>("coaches");
    const rakeTransfersCol = await getCollection<{
      id: number;
      from_zone: string;
      to_zone: string;
      coach_ids: number[];
      scheduled_at: Date;
      status: string;
      estimated_savings_km: number;
    }>("rake_transfers");

    const availableCoaches = await coachesCol.find({ status: "available" }).limit(9).project<{ id: number }>({ id: 1, _id: 0 }).toArray();

    if (availableCoaches.length < 3) {
      return { success: false, proposals_created: 0, total_savings_km: 0 };
    }

    const proposals = [
      { from: "Central", to: "South", coachSlice: availableCoaches.slice(0, 3), savings: 720.5 },
      { from: "East", to: "West", coachSlice: availableCoaches.slice(3, 6), savings: 1340.0 },
    ];

    let totalSavings = 0;
    let created = 0;
    for (const p of proposals) {
      if (p.coachSlice.length === 0) continue;
      await rakeTransfersCol.insertOne({
        id: await nextId("rake_transfers"),
        from_zone: p.from,
        to_zone: p.to,
        coach_ids: p.coachSlice.map((coach) => coach.id),
        scheduled_at: new Date(Date.now() + 8 * 60 * 60 * 1000),
        status: "proposed",
        estimated_savings_km: p.savings,
      });
      totalSavings += p.savings;
      created++;
    }

    return { success: true, proposals_created: created, total_savings_km: totalSavings };
  }
);
