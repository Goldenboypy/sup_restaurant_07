/**
 * pages/Home.tsx
 * Step 1 of the guest flow: Logo (top), a big centered [ MENU ] button,
 * and the Offers strip (Weekly Special | Specialties | Limited) below it.
 * Identity here is the table-session token established from the QR scan
 * (see hooks/useTableSession.ts) -- there is no login for guests.
 */
import { useEffect } from "react";

import Logo from "../components/logo";
import MenuButton from "../components/MenuButton";
import OffersStrip from "../components/OffersStrip";
import { useTableSession } from "../hooks/useTableSession";
import { fetchCategories } from "../api/menu";

export default function Home(): JSX.Element {
  const { session, isLoading } = useTableSession();

  // Prefetch categories so CategoryList can render instantly once the
  // guest taps MENU; failures here are non-critical (CategoryList will
  // simply fetch again on mount).
  useEffect(() => {
    if (session) {
      fetchCategories().catch(() => {
        /* prefetch only; CategoryList handles its own error state */
      });
    }
  }, [session]);

  return (
    <div className="home">
      <Logo />
      {isLoading ? (
        <p className="home__welcome">Starting your table session...</p>
      ) : session ? (
        <p className="home__welcome">Welcome to Table {session.table_number}</p>
      ) : (
        <>
          <p className="home__welcome">
            Welcome to the restaurant menu. Browse the dishes here.
          </p>
          <p className="home__subtitle">
            Scan the table QR code to unlock ordering and send your request to the waiter.
          </p>
        </>
      )}
      <MenuButton />
      <OffersStrip />
    </div>
  );
}