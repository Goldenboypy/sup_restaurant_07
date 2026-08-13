import type { Table } from "../types/table";

interface TableCardProps {
  table: Table;
}

const STATUS_LABEL: Record<Table["status"], string> = {
  free: "Free",
  occupied: "Occupied",
  bill_requested: "Bill Requested",
};

/**
 * One tile in the Waiter View table map: "Shows every table with its
 * status: Free | Occupied | Bill Requested." Purely presentational —
 * TableMap.tsx wraps it in a <Link> to /tables/:id, so this component
 * has no navigation or click handling of its own.
 */
export default function TableCard({ table }: TableCardProps) {
  return (
    <div className={`table-card table-card--${table.status}`}>
      <span className="table-card__number">Table {table.number}</span>
      <span className="table-card__status">{STATUS_LABEL[table.status]}</span>
      <span className="table-card__waiter">
        {table.assigned_waiter ? table.assigned_waiter.name : "Unassigned"}
      </span>
    </div>
  );
}