import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

const highlights = [
  { v: "Asistencia", l: "Control diario" },
  { v: "Horas", l: "Normales y extra" },
  { v: "Sueldos", l: "Liquidaciones" },
];

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
    <div className="min-h-screen flex" style={{ fontFamily: "'DM Sans', sans-serif", background: "#F1F5F9" }}>
      {/* Left panel */}
      <div
        className="login-left"
        style={{
          width: "45%",
          background: "#0A0F1C",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `radial-gradient(circle at 20% 80%, rgba(245,158,11,.1) 0%, transparent 50%),
                              radial-gradient(circle at 80% 20%, rgba(34,197,94,.07) 0%, transparent 50%)`,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(rgba(255,255,255,.015) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,.015) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <img src="/logo.svg" alt="POLYSAN / POLCECAL" width={190} style={{ objectFit: "contain" }} />
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <h1
            style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800,
              fontSize: "clamp(26px, 3vw, 40px)",
              color: "#F1F5F9",
              lineHeight: 1.15,
              marginBottom: 16,
            }}
          >
            Sistema de<br />
            <span style={{ color: "#F59E0B" }}>Gestión</span> de<br />
            Operarios
          </h1>
          <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.6, maxWidth: 320 }}>
            Fichadas, horas normales y extra, francos compensatorios, asistencia, vacaciones y liquidación de sueldos.
          </p>
          <div style={{ display: "flex", gap: 32, marginTop: 40 }}>
            {highlights.map((s) => (
              <div key={s.v}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 20, color: "#F59E0B" }}>{s.v}</div>
                <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: ".08em" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#1E2A3A", position: "relative", zIndex: 1 }}>
          © {new Date().getFullYear()} POLCECAL / POLYSAN S.A.
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 26, color: "#0F172A", marginBottom: 8 }}>
              Bienvenido
            </h2>
            <p style={{ color: "#64748B", fontSize: 14 }}>Ingresá con tu cuenta para continuar.</p>
          </div>

          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 6, letterSpacing: ".08em", textTransform: "uppercase" }}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                className="input"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 6, letterSpacing: ".08em", textTransform: "uppercase" }}>
                Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
              />
            </div>

            {error && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "13px", marginTop: 8, fontSize: 15 }}
            >
              {loading ? "Ingresando..." : "Ingresar →"}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) { .login-left { display: none !important; } }
      `}</style>
    </div>
  );
}
