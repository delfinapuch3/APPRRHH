import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch {
      setError("Email o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <form onSubmit={onSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-6 text-slate-800">Gestión de Operarios</h1>
        <label className="block text-sm text-slate-600 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 mb-4 text-sm"
        />
        <label className="block text-sm text-slate-600 mb-1">Contraseña</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 mb-4 text-sm"
        />
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
