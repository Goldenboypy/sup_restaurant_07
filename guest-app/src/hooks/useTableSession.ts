import { useContext } from "react";
import { TableSessionContext } from "../context/TableSessionContext";

/**
 * Access the guest's table session (identity = QR-derived token).
 * Must be used within a <TableSessionProvider>.
 */
export function useTableSession() {
  const context = useContext(TableSessionContext);

  if (context === undefined) {
    throw new Error("useTableSession must be used within a TableSessionProvider");
  }

  return context;
}