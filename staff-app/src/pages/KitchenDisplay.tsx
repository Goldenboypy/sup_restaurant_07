import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchKitchenTickets,
  updateTicketStatus,
  type KitchenTicketStatus,
} from "../api/kitchen";
import { useKitchenNotificationsWS } from "../hooks/useKitchenNotificationsWS";
import TicketCard from "../components/TicketCard";
import type { KitchenTicket, TicketStatus } from "../types/ticket";

const COLUMNS: { status: TicketStatus; label: string }[] = [
  { status: "new", label: "New" },
  { status: "in_progress", label: "In Progress" },
  { status: "ready", label: "Ready" },
];

/**
 * Kitchen view step 4 (Ticket Handling): "Kitchen display receives
 * each confirmed order as a new ticket. Kitchen marks it: New -> In
 * Progress -> Ready. The moment a ticket is marked Ready, the
 * ORIGINAL assigned waiter is notified" — that notification is a
 * server-side side effect of the PATCH below, not something this
 * page has to trigger itself.
 *
 * GET   /api/staff/kitchen/tickets
 * PATCH /api/staff/kitchen/tickets/:id (status: in_progress | ready)
 */
export default function KitchenDisplay() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTickets = useCallback(async () => {
    const data = await fetchKitchenTickets();
    setTickets(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  // ws/staff/kitchen/ ticket.new -- a waiter-confirmed order just arrived
  const { lastEvent } = useKitchenNotificationsWS();
  useEffect(() => {
    if (lastEvent?.type === "ticket.new") {
      void loadTickets();
    }
  }, [lastEvent, loadTickets]);

  const ticketsByStatus = useMemo(() => {
    const grouped: Record<TicketStatus, KitchenTicket[]> = {
      new: [],
      in_progress: [],
      ready: [],
    };
    for (const ticket of tickets) {
      grouped[ticket.status].push(ticket);
    }
    return grouped;
  }, [tickets]);

  const nextStatus = (status: TicketStatus): KitchenTicketStatus | null => {
    if (status === "new") return "in_progress";
    if (status === "in_progress") return "ready";
    return null;
  };

  const advanceTicket = async (ticket: KitchenTicket) => {
    const target = nextStatus(ticket.status);
    if (!target) return;

    const updated = await updateTicketStatus(ticket.id, target);
    setTickets((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  };

  if (isLoading) {
    return (
      <div className="kitchen-display__loading" role="status" aria-live="polite">
        Loading tickets…
      </div>
    );
  }

  return (
    <div className="kitchen-display">
      <h1 className="kitchen-display__title">Kitchen</h1>

      <div className="kitchen-display__board">
        {COLUMNS.map((column) => (
          <div key={column.status} className="kitchen-display__column">
            <h2 className="kitchen-display__column-title">{column.label}</h2>

            {ticketsByStatus[column.status].map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onAdvance={
                  column.status === "ready"
                    ? undefined
                    : () => advanceTicket(ticket)
                }
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}