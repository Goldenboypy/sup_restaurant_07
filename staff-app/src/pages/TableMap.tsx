import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchTables } from "../api/tables";
import { useWaiterNotificationsWS } from "../hooks/useWaiterNotificationsWS";
import TableCard from "../components/TableCard";
import type { Table } from "../types/table";

/**
 * Waiter view step 1: "Shows every table with its status: Free |
 * Occupied | Bill Requested. Tapping a table shows: assigned waiter
 * (or 'unassigned'), current order status, and session history."
 *
 * GET /api/staff/tables. Table state also shifts from events this
 * waiter has no direct hand in (a confirmed order, a ready ticket, a
 * new payment request), so the map refreshes whenever this waiter
 * gets any push notification on ws/staff/waiter/<waiter_id>/.
 */
export default function TableMap() {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTables = useCallback(async () => {
    try {
      const data = await fetchTables();
      setTables(data);
      setError(null);
    } catch {
      setError("Could not load the table map.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  const { lastEvent } = useWaiterNotificationsWS();

  useEffect(() => {
    if (lastEvent) {
      void loadTables();
    }
  }, [lastEvent, loadTables]);

  if (isLoading) {
    return (
      <div className="table-map__loading" role="status" aria-live="polite">
        Loading tables…
      </div>
    );
  }

  return (
    <div className="table-map">
      <h1 className="table-map__title">Tables</h1>

      {error && (
        <p className="table-map__error" role="alert">
          {error}
        </p>
      )}

      <div className="table-map__grid">
        {tables.map((table) => (
          <Link
            key={table.id}
            to={`/tables/${table.id}`}
            className="table-map__link"
            aria-label={`Table ${table.number}, ${table.status.replace("_", " ")}`}
          >
            <TableCard table={table} />
          </Link>
        ))}
      </div>
    </div>
  );
}