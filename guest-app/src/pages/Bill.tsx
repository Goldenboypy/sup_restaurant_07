import { useCallback, useEffect, useState } from "react";

import PaymentMethodPicker, {
  type PaymentMethod,
} from "../components/PaymentMethodPicker";
import { fetchBill, fetchOrders } from "../api/orders";
import { useOrderStatusWS } from "../hooks/useOrderStatusWS";
import type { Bill as BillData, Order, OrderStatus } from "../types/order";

const STATUS_LABELS: Record<OrderStatus, string> = {
  submitted: "Submitted",
  waiter_confirmed: "Confirmed",
  kitchen_in_progress: "Preparing",
  ready: "Ready",
  served: "Served",
};

type Stage = "locked" | "choosing" | "requested";

export default function Bill(): JSX.Element {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stage, setStage] = useState<Stage>("locked");
  const [bill, setBill] = useState<BillData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { lastEvent } = useOrderStatusWS();

  const refreshOrders = useCallback(async () => {
    const current = await fetchOrders();
    setOrders(current);
  }, []);

  useEffect(() => {
    void refreshOrders().catch(() => {
      setError("Could not load your order statuses.");
    });

    const interval = window.setInterval(() => {
      void refreshOrders().catch(() => undefined);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [refreshOrders]);

  useEffect(() => {
    if (lastEvent?.type !== "order.status_changed") return;
    setOrders((previous) =>
      previous.map((order) =>
        order.id === lastEvent.order_id
          ? { ...order, status: lastEvent.status }
          : order
      )
    );
  }, [lastEvent]);

  const allOrdersServed =
    orders.length > 0 && orders.every((order) => order.status === "served");

  async function handleSelectMethod(method: PaymentMethod) {
    setError(null);
    try {
      // PaymentMethodPicker sends the payment request and notifies the waiter.
      void method;
      const result = await fetchBill();
      setBill(result);
      setStage("requested");
    } catch {
      setError("Could not load your bill. Please try again.");
      setStage("choosing");
    }
  }

  if (stage === "requested" && bill) {
    return (
      <div className="bill">
        <h1>Your Bill</h1>
        <div className="bill-summary">
          {bill.orders.map((order) => (
            <section key={order.id} className="bill-summary__order">
              <h2>Order #{order.id}</h2>
              {order.items.map((line) => (
                <div className="bill-summary__row" key={line.cart_item_id}>
                  <span>
                    {line.name} x{line.quantity}
                    {line.excluded_ingredients.length > 0 && (
                      <small>
                        No {line.excluded_ingredients.join(", ")}
                      </small>
                    )}
                  </span>
                  <span>{Number(line.price).toFixed(2)} {bill.currency}</span>
                </div>
              ))}
            </section>
          ))}
          <p className="bill-summary__total">{bill.total} {bill.currency}</p>
        </div>
        <p role="status">
          Your waiter has been notified and will collect payment and clear the table.
        </p>
      </div>
    );
  }

  if (stage === "choosing") {
    return (
      <div className="bill">
        <h1>Choose how to pay</h1>
        {error && <p role="alert">{error}</p>}
        <PaymentMethodPicker onRequested={handleSelectMethod} />
      </div>
    );
  }

  return (
    <div className="bill">
      <h1>Your Bill</h1>
      <ul aria-label="Order statuses">
        {orders.map((order) => (
          <li key={order.id} className="order-status-row">
            <span>Order #{order.id}</span>
            <span>{STATUS_LABELS[order.status] ?? order.status}</span>
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
      <p>
        {orders.length === 0
          ? "Place an order before requesting payment."
          : allOrdersServed
            ? "All orders have been served."
            : "Payment becomes available when every order has been served."}
      </p>
      <button
        className="btn btn--primary"
        type="button"
        onClick={() => setStage("choosing")}
        disabled={!allOrdersServed}
      >
        Pay
      </button>
    </div>
  );
}
