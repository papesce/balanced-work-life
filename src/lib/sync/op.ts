import type { AbstractPowerSyncDatabase } from "@powersync/web";

export interface UploadOp {
  table: string;
  op: string;
  id: string;
  opData?: Record<string, unknown> | null;
}

export function throwIfSupabaseError(
  error: { message: string; code?: string } | null,
  tag: string,
): void {
  if (error) {
    throw new Error(`${tag}: ${error.message}${error.code ? ` (code ${error.code})` : ""}`);
  }
}

export type TableUploadHandler = (
  op: UploadOp,
  database: AbstractPowerSyncDatabase,
) => Promise<void>;
