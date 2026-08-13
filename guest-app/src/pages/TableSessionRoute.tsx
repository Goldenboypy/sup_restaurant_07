import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";

import Logo from "../components/logo";
import { useTableSession } from "../hooks/useTableSession";

/** Resolves /t/:qr_token before allowing the guest to enter Home. */
export default function TableSessionRoute(): JSX.Element {
  const { qrToken } = useParams<{ qrToken: string }>();
  const { session, isLoading, error, startSession } = useTableSession();

  useEffect(() => {
    if (qrToken) {
      void startSession(qrToken);
    }
  }, [qrToken, startSession]);

  if (!qrToken) {
    return (
      <div className="home" role="alert">
        <Logo />
        <p>Please scan a valid table QR code to start.</p>
      </div>
    );
  }

  if (isLoading || (!session && !error)) {
    return (
      <div className="home" aria-busy="true">
        <Logo />
        <p>Starting your table session...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="home" role="alert">
        <Logo />
        <p>{error ?? "This table session is unavailable. Please scan the QR code again."}</p>
      </div>
    );
  }

  return <Navigate to="/" replace />;
}