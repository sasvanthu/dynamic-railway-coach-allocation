import { Collection, Db, Document, MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME ?? "railmind";

let client: MongoClient | null = null;
let database: Db | null = null;

export async function getDb(): Promise<Db> {
  if (database) return database;

  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it to your environment before starting the backend.");
  }

  client = new MongoClient(uri);
  await client.connect();
  database = client.db(dbName);
  return database;
}

export async function getCollection<T extends Document = Document>(name: string): Promise<Collection<T>> {
  const db = await getDb();
  return db.collection<T>(name);
}

interface CounterDoc extends Document {
  _id: string;
  value: number;
}

export async function nextId(sequence: string): Promise<number> {
  const counters = await getCollection<CounterDoc>("counters");
  const result = await counters.findOneAndUpdate(
    { _id: sequence },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after" },
  );

  if (!result) {
    throw new Error(`Failed to generate next id for sequence: ${sequence}`);
  }

  return result.value;
}

export function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}
