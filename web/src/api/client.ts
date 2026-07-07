import axios from "axios";

export const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (!location.pathname.startsWith("/login")) {
        location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

/** Extrae el mensaje más útil posible de un error de axios para mostrarlo en pantalla. */
export function errorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;
  const anyErr = err as { response?: { data?: { error?: unknown } }; request?: unknown; message?: string };
  const serverError = anyErr.response?.data?.error;
  if (typeof serverError === "string" && serverError.trim()) return serverError;
  if (serverError && typeof serverError === "object") {
    // errores de validación de zod (flatten): mostrar el primer mensaje de campo si existe
    const flat = serverError as { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
    const primero = flat.formErrors?.[0] ?? Object.values(flat.fieldErrors ?? {})[0]?.[0];
    if (primero) return primero;
  }
  if (anyErr.request && !anyErr.response) return "No se pudo conectar con el servidor. Verificá que esté corriendo.";
  return fallback;
}
