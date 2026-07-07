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

const NO_SE_PUDO_CONECTAR = "No se pudo conectar con el servidor. Verificá que esté corriendo.";

/** Extrae el mensaje más útil posible de un error de axios para mostrarlo en pantalla. */
export function errorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;
  const anyErr = err as { response?: { status?: number; data?: unknown }; request?: unknown; message?: string };
  const data = anyErr.response?.data;
  const serverError = data && typeof data === "object" ? (data as { error?: unknown }).error : undefined;
  if (typeof serverError === "string" && serverError.trim()) return serverError;
  if (serverError && typeof serverError === "object") {
    // errores de validación de zod (flatten): mostrar el primer mensaje de campo si existe
    const flat = serverError as { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
    const primero = flat.formErrors?.[0] ?? Object.values(flat.fieldErrors ?? {})[0]?.[0];
    if (primero) return primero;
  }
  if (anyErr.request && !anyErr.response) return NO_SE_PUDO_CONECTAR;
  // Un 5xx sin el formato { error } esperado no vino de nuestra API: es el proxy de
  // Vite (u otro intermediario) avisando que no pudo llegar al backend, no un error
  // real de la operación. Mostrar eso tal cual en vez del fallback específico evita
  // confundir "el servidor está apagado" con "el archivo está mal".
  if ((anyErr.response?.status ?? 0) >= 500 && serverError === undefined) return NO_SE_PUDO_CONECTAR;
  return fallback;
}
