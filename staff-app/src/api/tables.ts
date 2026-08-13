import { staffRequest } from "./auth";
import type { Table, TableStatus } from "../types/table";

/** GET /api/staff/tables — status + assigned_waiter. */
export function fetchTables(): Promise<Table[]> {
  return staffRequest<Table[]>("/tables");
}

/** GET /api/staff/tables/:id — single table for the detail screen. */
export function fetchTable(tableId: number): Promise<Table> {
  return staffRequest<Table>(`/tables/${tableId}`);
}

/** PATCH /api/staff/tables/:id/status — free / occupied. */
export function updateTableStatus(
  tableId: number,
  status: TableStatus
): Promise<Table> {
  return staffRequest<Table>(`/tables/${tableId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/** PATCH /api/staff/tables/:id/assign — self-assign as waiter. */
export function assignSelfToTable(tableId: number): Promise<Table> {
  return staffRequest<Table>(`/tables/${tableId}/assign`, {
    method: "PATCH",
  });
}

/** GET /api/staff/tables/:id/qr — QR code image/data. */
export function fetchTableQr(tableId: number): Promise<{ image_url: string }> {
  return staffRequest<{ image_url: string }>(`/tables/${tableId}/qr`);
}