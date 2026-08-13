import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import Bill from "./pages/Bill";
import Cart from "./pages/Cart";
import CategoryList from "./pages/CategoryList";
import ConfigureOrder from "./pages/ConfigureOrder";
import Home from "./pages/Home";
import ProductDetail from "./pages/ProductDetail";
import ProductList from "./pages/Productlist";
import TableSessionRoute from "./pages/TableSessionRoute";
import CartIcon from "./components/CardIcon";
import { useTableSession } from "./hooks/useTableSession";

function ScrollToTop(): null {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}

function GuestLayout(): JSX.Element {
  return (
    <>
      <header className="guest-header">
        <CartIcon />
      </header>
      <main id="main-content" style={{ minHeight: "100vh" }}>
        <Outlet />
      </main>
    </>
  );
}

function SessionGate(): JSX.Element {
  const { session, isLoading, error } = useTableSession();

  if (isLoading) {
    return <p aria-busy="true">Starting your table session...</p>;
  }

  if (!session) {
    return (
      <div role="alert">
        <p>{error ?? "Please scan the table QR code to start ordering."}</p>
      </div>
    );
  }

  return <Outlet />;
}

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<GuestLayout />}>
          <Route path="t" element={<TableSessionRoute />} />
          <Route path="t/:qrToken" element={<TableSessionRoute />} />

          <Route index element={<Home />} />

          <Route path="menu">
            <Route index element={<CategoryList />} />
            <Route path=":categoryId" element={<ProductList />} />
            <Route path=":categoryId/:itemId" element={<ProductDetail />} />

            <Route element={<SessionGate />}>
              <Route path=":categoryId/:itemId/configure" element={<ConfigureOrder />} />
            </Route>
          </Route>

          <Route element={<SessionGate />}>
            <Route path="cart" element={<Cart />} />
            <Route path="orders" element={<Cart />} />
            <Route path="bill" element={<Bill />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}