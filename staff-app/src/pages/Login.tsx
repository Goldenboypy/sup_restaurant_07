import { useState, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";

/**
 * KEPT pattern from v1.0: plain username/password form against the
 * same Bearer-token auth.py. On success, App.tsx's route guard
 * redirects automatically once isAuthenticated flips — this page
 * does not navigate itself.
 */
export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await login(username, password);
    } catch {
      setError("Incorrect username or password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login">
      <h1 className="login__title">Staff Login</h1>

      <form className="login__form" onSubmit={handleSubmit}>
        <label className="login__field">
          Username
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="login__field">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && (
          <p className="login__error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="login__submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}