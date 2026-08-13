import type { Waiter } from "../types/table";

interface WaiterBadgeProps {
  waiter: Waiter | null;
}

/**
 * "assigned waiter (or 'unassigned')" — shown on the Table Map and
 * Table Detail screens. The unassigned state is explicit, not a
 * blank, so a waiter scanning the map can tell "no one owns this
 * table yet" from "data hasn't loaded".
 */
export default function WaiterBadge({ waiter }: WaiterBadgeProps) {
  if (!waiter) {
    return (
      <span className="waiter-badge waiter-badge--unassigned">Unassigned</span>
    );
  }

  return <span className="waiter-badge">{waiter.name}</span>;
}