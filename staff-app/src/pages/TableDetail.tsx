import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  assignSelfToTable,
  fetchTable,
  fetchTableQr,
  updateTableStatus,
} from "../api/tables";
import QRCodeModal from "../components/QRCodeModal";
import WaiterBadge from "../components/WaiterBadge";
import type { Table, TableStatus } from "../types/table";

/**
 * Waiter view step 2 (Seating a New Guest): waiter picks a Free
 * table, marks it Occupied, self-assigns, then opens/shows the
 * table's QR code so the guest can scan it and open the menu.
 *
 * PATCH /api/staff/tables/:id/status
 * PATCH /api/staff/tables/:id/assign
 * GET   /api/staff/tables/:id/qr
 */
export default function TableDetail() {
  const { tableId } = useParams<{ tableId: string }>();
  const [table, setTable] = useState<Table | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const loadTable = useCallback(async () => {
    if (!tableId) return;
    try {
      const data = await fetchTable(Number(tableId));
      setTable(data);
      setError(null);
    } catch {
      setError("Could not load this table.");
    } finally {
      setIsLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    void loadTable();
  }, [loadTable]);

  const handleAssignSelf = async () => {
    if (!tableId || isUpdating) return;
    setIsUpdating(true);
    try {
      setTable(await assignSelfToTable(Number(tableId)));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = async (status: TableStatus) => {
    if (!tableId || isUpdating) return;
    setIsUpdating(true);
    try {
      setTable(await updateTableStatus(Number(tableId), status));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleShowQr = async () => {
    if (!tableId) return;
    if (!qrImageUrl) {
      const qr = await fetchTableQr(Number(tableId));
      setQrImageUrl(qr.image_url);
    }
    setIsQrOpen(true);
  };

  if (isLoading) {
    return (
      <div className="table-detail__loading" role="status" aria-live="polite">
        Loading table…
      </div>
    );
  }

  if (error || !table) {
    return (
      <p className="table-detail__error" role="alert">
        {error ?? "Table not found."}
      </p>
    );
  }

  return (
    <div className="table-detail">
      <h1 className="table-detail__title">Table {table.number}</h1>
      <p className="table-detail__status">
        Status: {table.status.replace("_", " ")}
      </p>

      <WaiterBadge waiter={table.assigned_waiter ?? null} />

      <div className="table-detail__actions">
        <button type="button" onClick={handleAssignSelf} disabled={isUpdating}>
          Assign myself
        </button>
        <button
          type="button"
          onClick={() => handleStatusChange("occupied")}
          disabled={isUpdating || table.status === "occupied"}
        >
          Mark occupied
        </button>
        <button
          type="button"
          onClick={() => handleStatusChange("free")}
          disabled={isUpdating || table.status === "free"}
        >
          Mark free
        </button>
        <button type="button" onClick={handleShowQr}>
          Show QR code
        </button>
      </div>

      {isQrOpen && qrImageUrl && (
        <QRCodeModal
          imageUrl={qrImageUrl}
          tableNumber={String(table.number)}
          onClose={() => setIsQrOpen(false)}
        />
      )}
    </div>
  );
}