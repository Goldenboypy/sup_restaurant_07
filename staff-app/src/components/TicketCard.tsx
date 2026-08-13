import type { KitchenTicket } from "../types/ticket";

interface TicketCardProps {
  ticket: KitchenTicket;
  onAdvance?: () => void;
}

const ADVANCE_LABEL: Record<KitchenTicket["status"], string | null> = {
  new: "Start",
  in_progress: "Mark Ready",
  ready: null,
};

/**
 * One ticket on the Kitchen board: "Kitchen marks it: New -> In
 * Progress -> Ready." The advance button's label tracks the current
 * column, and disappears entirely once Ready — there's nothing
 * further to advance it to (onAdvance is omitted by the caller for
 * that column).
 */
export default function TicketCard({ ticket, onAdvance }: TicketCardProps) {
  const advanceLabel = ADVANCE_LABEL[ticket.status];

  return (
    <div className={`ticket-card ticket-card--${ticket.status}`}>
      <div className="ticket-card__header">
        <span className="ticket-card__table">Table {ticket.table_number}</span>
        <span className="ticket-card__time">
          {new Date(ticket.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      <ul className="ticket-card__items">
        {ticket.items.map((item, index) => (
          <li key={index} className="ticket-card__item">
            {item.quantity}× {item.name}
            {item.excluded_ingredients.length > 0 && (
              <span className="ticket-card__exclusions">
                {" "}
                (no {item.excluded_ingredients.join(", ")})
              </span>
            )}
          </li>
        ))}
      </ul>

      {advanceLabel && onAdvance && (
        <button
          type="button"
          className="ticket-card__advance"
          onClick={onAdvance}
        >
          {advanceLabel}
        </button>
      )}
    </div>
  );
}