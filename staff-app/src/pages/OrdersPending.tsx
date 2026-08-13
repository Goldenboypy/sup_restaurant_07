import { useCallback, useEffect, useState } from "react";
import { confirmOrder, fetchPendingOrders } from "../api/orders";
import { useWaiterNotificationsWS } from "../hooks/useWaiterNotificationsWS";
import OrderConfirmCard from "../components/OderConfirmCard";
import type { StaffOrder } from "../types/order";

/**
 * Waiter view step 3 (Incoming Order Notification): "The waiter must
 * CONFIRM the order before anything happens. Confirming forwards the
 * order to the Kitchen as a new ticket. Unconfirmed orders never
 * reach the kitchen." A confirmed order is removed from this list,
 * not merely flagged.
 *
 * GET   /api/staff/orders/pending
 * PATCH /api/staff/orders/:id/confirm
 */
export default function OrdersPending() {
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const loadOrders = useCallback(async () => {
    const data = await fetchPendingOrders();
    setOrders(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  // order.submitted -- new order needs this waiter's confirmation
  const { lastEvent } = useWaiterNotificationsWS();
  useEffect(() => {
    if (lastEvent?.type === "order.submitted") {
      void loadOrders();
    }
  }, [lastEvent, loadOrders]);

  const handleConfirm = async (orderId: number) => {
    setConfirmingId(orderId);
    try {
      await confirmOrder(orderId);
      setOrders((prev) => prev.filter((order) => order.id !== orderId));
    } finally {
      setConfirmingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="orders-pending__loading" role="status" aria-live="polite">
        Loading pending orders…
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <p className="orders-pending__empty">No orders waiting on confirmation.</p>
    );
  }

  return (
    <div className="orders-pending">
      <h1 className="orders-pending__title">Orders Awaiting Confirmation</h1>
      <ul className="orders-pending__list">
        {orders.map((order) => (
          <li key={order.id}>
            <OrderConfirmCard
              order={order}
              isConfirming={confirmingId === order.id}
              onConfirm={() => handleConfirm(order.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}