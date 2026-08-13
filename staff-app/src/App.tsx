import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import TableMap from "./pages/TableMap";
import TableDetail from "./pages/TableDetail";
import OrdersPending from "./pages/OrdersPending";
import KitchenDisplay from "./pages/KitchenDisplay";
import PaymentRequests from "./pages/PaymentRequests";

type StaffRole = "waiter" | "kitchen";

/** Where a signed-in user of a given role lands by default. */
function homeRouteFor(role: StaffRole): string {
  return role === "kitchen" ? "/kitchen" : "/tables";
}

/**
 * Route guard: requires an authenticated session (Bearer token, same
 * auth.py as v1.0) AND one of the allowed roles. "Role decides which
 * screens are shown after login" -- a waiter hitting a kitchen-only
 * route (or vice versa) is redirected to their own home, not just
 * blocked.
 */
function RequireRole({
  allow,
  children,
}: {
  allow: StaffRole[];
  children: ReactNode;
}) {
  const { isAuthenticated, isLoading, waiter } = useAuth();

  if (isLoading) {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated || !waiter) {
    return <Navigate to="/login" replace />;
  }

  if (!allow.includes(waiter.role)) {
    return <Navigate to={homeRouteFor(waiter.role)} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading, waiter } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated && waiter ? (
            <Navigate to={homeRouteFor(waiter.role)} replace />
          ) : (
            <Login />
          )
        }
      />

      {/* WAITER VIEW */}
      <Route
        path="/tables"
        element={
          <RequireRole allow={["waiter"]}>
            <TableMap />
          </RequireRole>
        }
      />
      <Route
        path="/tables/:tableId"
        element={
          <RequireRole allow={["waiter"]}>
            <TableDetail />
          </RequireRole>
        }
      />
      <Route
        path="/orders/pending"
        element={
          <RequireRole allow={["waiter"]}>
            <OrdersPending />
          </RequireRole>
        }
      />
      <Route
        path="/payment-requests"
        element={
          <RequireRole allow={["waiter"]}>
            <PaymentRequests />
          </RequireRole>
        }
      />

      {/* KITCHEN VIEW */}
      <Route
        path="/kitchen"
        element={
          <RequireRole allow={["kitchen"]}>
            <KitchenDisplay />
          </RequireRole>
        }
      />

      <Route
        path="/"
        element={
          isLoading ? (
            <div className="app-loading" role="status" aria-live="polite">
              Loading…
            </div>
          ) : (
            <Navigate
              to={
                isAuthenticated && waiter ? homeRouteFor(waiter.role) : "/login"
              }
              replace
            />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}