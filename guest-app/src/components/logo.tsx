import { Link } from "react-router-dom";

interface LogoProps {
  size?: "sm" | "md" | "lg";
}

/**
 * Top-of-screen brand mark on the Guest App Home screen.
 * Links back to "/" from anywhere in the guest flow.
 */
export default function Logo({ size = "md" }: LogoProps) {
  return (
    <Link to="/" className={`logo logo--${size}`} aria-label="Go to home">
      <img src="/assets/logo.svg" alt="" className="logo__mark" />
      <span className="logo__wordmark">Restaurant</span>
    </Link>
  );
}