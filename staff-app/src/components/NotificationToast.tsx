import { useEffect } from "react";

interface NotificationToastProps {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
}

/**
 * Ephemeral toast for staff push notifications — e.g.
 * "order.submitted", "ticket.ready", "payment.requested" on
 * ws/staff/waiter/<waiter_id>/, or "ticket.new" on ws/staff/kitchen/.
 * Self-contained so it can be dropped in wherever those events
 * surface. Auto-dismisses after durationMs, but stays keyboard/
 * screen-reader accessible via the explicit dismiss button.
 */
export default function NotificationToast({
  message,
  onDismiss,
  durationMs = 5000,
}: NotificationToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [onDismiss, durationMs]);

  return (
    <div className="notification-toast" role="status" aria-live="polite">
      <span className="notification-toast__message">{message}</span>
      <button
        type="button"
        className="notification-toast__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}