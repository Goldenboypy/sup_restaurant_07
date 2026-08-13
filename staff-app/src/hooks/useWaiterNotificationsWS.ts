/**
 * Staff App - useWaiterNotificationsWS hook
 *
 * Connects to ws/staff/waiter/<waiter_id>/ and streams the events that
 * concern this specific waiter:
 *   order.submitted     new order needs this waiter's confirmation
 *   ticket.ready         kitchen finished this waiter's ticket
 *   payment.requested    guest asked to pay - come to the table
 *
 * Auto-reconnects with exponential backoff while the waiter is
 * authenticated, and tears the socket down on unmount / logout.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './useAuth';

export type WaiterWSEventType = 'order.submitted' | 'ticket.ready' | 'payment.requested';

export interface OrderSubmittedPayload {
  order_id: string | number;
  table_id: string | number;
}

export interface TicketReadyPayload {
  ticket_id: string | number;
  order_id: string | number;
  table_id: string | number;
}

export interface PaymentRequestedPayload {
  payment_request_id: string | number;
  table_id: string | number;
  method: 'card' | 'cash';
}

export type WaiterWSEvent =
  | { type: 'order.submitted'; data: OrderSubmittedPayload }
  | { type: 'ticket.ready'; data: TicketReadyPayload }
  | { type: 'payment.requested'; data: PaymentRequestedPayload };

type ConnectionStatus = 'connecting' | 'open' | 'closed';

const WS_BASE =
  import.meta.env.VITE_STAFF_WS_BASE_URL ??
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

const MAX_RECONNECT_DELAY_MS = 15000;

export function useWaiterNotificationsWS() {
  const { waiter, token, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>('closed');
  const [events, setEvents] = useState<WaiterWSEvent[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(true);

  const connect = useCallback(() => {
    if (!isAuthenticated || !waiter || !token) {
      return;
    }

    setStatus('connecting');
    const url = `${WS_BASE}/ws/staff/waiter/${waiter.id}/?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      reconnectAttemptRef.current = 0;
      setStatus('open');
    };

    socket.onmessage = (message: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(message.data) as WaiterWSEvent;
        setEvents((prev) => [...prev, parsed]);
      } catch {
        // ignore malformed frames
      }
    };

    socket.onclose = () => {
      setStatus('closed');
      socketRef.current = null;

      if (shouldReconnectRef.current) {
        const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, MAX_RECONNECT_DELAY_MS);
        reconnectAttemptRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      }
    };

    socket.onerror = () => {
      socket.close();
    };
  }, [isAuthenticated, waiter, token]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      socketRef.current?.close();
    };
  }, [connect]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { status, events, lastEvent: events.at(-1) ?? null, clearEvents };
}