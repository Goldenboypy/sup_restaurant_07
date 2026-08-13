import { useCallback, useEffect, useState } from "react";
import { completePaymentRequest, getPaymentRequests } from "../api/payment";
import { useWaiterNotificationsWS } from "../hooks/useWaiterNotificationsWS";
import type { StaffPaymentRequest } from "../types/payment";

/**
 * Waiter view step 7 (Payment Request): "the table flips to 'Bill
 * Requested' and the assigned waiter is notified. Waiter brings the
 * card terminal or collects cash. Waiter clears the table (dishes)
 * and finalizes the payment. Table status returns to Free."
 *
 * GET   /api/staff/payment-requests
 * PATCH /api/staff/payment-requests/:id (complete -> table becomes Free)
 */
export default function PaymentRequests() {
  const [requests, setRequests] = useState<StaffPaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [completingId, setCompletingId] = useState<number | null>(null);

  const loadRequests = useCallback(async () => {
    const data = await getPaymentRequests();
    setRequests(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  // payment.requested -- guest asked to pay, come to the table
  const { lastEvent } = useWaiterNotificationsWS();
  useEffect(() => {
    if (lastEvent?.type === "payment.requested") {
      void loadRequests();
    }
  }, [lastEvent, loadRequests]);

  const handleComplete = async (requestId: number) => {
    setCompletingId(requestId);
    try {
      await completePaymentRequest(requestId);
      setRequests((prev) => prev.filter((request) => request.id !== requestId));
    } finally {
      setCompletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="payment-requests__loading" role="status" aria-live="polite">
        Loading payment requests…
      </div>
    );
  }

  if (requests.length === 0) {
    return <p className="payment-requests__empty">No tables waiting to be paid.</p>;
  }

  return (
    <div className="payment-requests">
      <h1 className="payment-requests__title">Payment Requests</h1>
      <ul className="payment-requests__list">
        {requests.map((request) => (
          <li key={request.id} className="payment-requests__item">
            <span className="payment-requests__table">
              Table {request.table_number}
            </span>
            <span className="payment-requests__method">{request.method}</span>
            <span className="payment-requests__total">
              {request.currency ?? ""}
              {request.total == null ? "" : request.total.toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() => handleComplete(request.id)}
              disabled={completingId === request.id}
            >
              {completingId === request.id ? "Clearing…" : "Mark paid & clear table"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}