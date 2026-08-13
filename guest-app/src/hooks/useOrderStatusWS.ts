import { useEffect, useRef, useState } from "react";
import { useTableSession } from "./useTableSession";
import type { OrderStatus } from "../types/order";

const WS_BASE = import.meta.env.VITE_WS_BASE_URL ?? "";

interface OrderStatusChangedEvent {
  type: "order.status_changed";
  order_id: number;
  status: OrderStatus;
}

interface BillReadyEvent {
  type: "bill.ready";
}

type GuestSocketEvent = OrderStatusChangedEvent | BillReadyEvent;

interface UseOrderStatusWSResult {
  lastEvent: GuestSocketEvent | null;
  isConnected: boolean;
}

/**
 * Subscribes to ws/guest/table/<session_token>/ for this guest's
 * order status updates (submitted/confirmed/preparing/ready/served)
 * and the bill.ready event — sent only after the guest has tapped Pay.
 */
export function useOrderStatusWS(): UseOrderStatusWSResult {
  const { session } = useTableSession();
  const [lastEvent, setLastEvent] = useState<GuestSocketEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    const socket = new WebSocket(
      `${WS_BASE}/ws/guest/table/${session.session_token}/`
    );
    socketRef.current = socket;

    socket.onopen = () => setIsConnected(true);
    socket.onclose = () => setIsConnected(false);

    socket.onmessage = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as GuestSocketEvent;
        setLastEvent(parsed);
      } catch {
        // Ignore malformed frames rather than crashing the guest UI.
      }
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [session]);

  return { lastEvent, isConnected };
}