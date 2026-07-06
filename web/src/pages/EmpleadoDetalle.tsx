import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";

interface Empleado {
  id: string;
  legajo: string;
  nombre: string;
  apellido: string;
  sindicato: string | null;
  fechaIngreso: string;
  valorHoraNormal: number;
  obra: { nombre: string } | null;
}

const tabs = ["fichadas", "ausencias", "vacaciones", "francos"] as const;
type Tab = (typeof tabs)[number];

export default function EmpleadoDetalle() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("fichadas");

  const { data: empleado } = useQuery({
    queryKey: ["empleado", id],
    queryFn: async () => (await api.get(`/empleados/${id}`)).data as Empleado,
  });

  const { data: fichadas } = useQuery({
    queryKey: ["fichadas", id],
    queryFn: async () => (await api.get(`/fichadas?employeeId=${id}`)).data as any[],
    enabled: tab === "fichadas",
  });
  const { data: ausencias } = useQuery({
    queryKey: ["ausencias", id],
    queryFn: async () => (await api.get(`/ausencias?employeeId=${id}`)).data as any[],
    enabled: tab === "ausencias",
  });
  const { data: vacaciones } = useQuery({
    queryKey: ["vacaciones-balance", id],
    queryFn: async () => (await api.get(`/vacaciones/${id}/balance`)).data,
    enabled: tab === "vacaciones",
  });
  const { data: francos } = useQuery({
    queryKey: ["francos", id],
    queryFn: async () => (await api.get(`/francos?employeeId=${id}`)).data as any[],
    enabled: tab === "francos",
  });

  if (!empleado) return <p className="text-slate-500">Cargando...</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800">
        {empleado.apellido}, {empleado.nombre}
      </h1>
      <p className="text-slate-500 mb-6">
        Legajo {empleado.legajo} · {empleado.obra?.nombre ?? "Sin obra"}
        {empleado.sindicato ? ` · ${empleado.sindicato}` : ""} · $
        {empleado.valorHoraNormal.toLocaleString("es-AR")}/hora
      </p>

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm capitalize ${
              tab === t ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-5">
        {tab === "fichadas" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">Fecha</th>
                <th className="pb-2">Entrada</th>
                <th className="pb-2">Salida</th>
                <th className="pb-2">Origen</th>
              </tr>
            </thead>
            <tbody>
              {fichadas?.map((f) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="py-2">{new Date(f.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                  <td className="py-2">{new Date(f.horaEntrada).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="py-2">
                    {f.horaSalida ? new Date(f.horaSalida).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "-"}
                  </td>
                  <td className="py-2">{f.origen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "ausencias" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">Desde</th>
                <th className="pb-2">Hasta</th>
                <th className="pb-2">Tipo</th>
                <th className="pb-2">Justificada</th>
                <th className="pb-2">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {ausencias?.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2">{new Date(a.fechaDesde).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                  <td className="py-2">{new Date(a.fechaHasta).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                  <td className="py-2">{a.tipo}</td>
                  <td className="py-2">{a.justificada ? "Sí" : "No"}</td>
                  <td className="py-2">{a.observaciones ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "vacaciones" && vacaciones && (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <div className="text-sm text-slate-500">Días correspondientes</div>
                <div className="text-2xl font-semibold">{vacaciones.correspondientes}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Días tomados</div>
                <div className="text-2xl font-semibold">{vacaciones.tomados}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Días restantes</div>
                <div className="text-2xl font-semibold text-emerald-600">{vacaciones.restantes}</div>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="pb-2">Desde</th>
                  <th className="pb-2">Hasta</th>
                  <th className="pb-2">Días</th>
                </tr>
              </thead>
              <tbody>
                {vacaciones.periodos.map((p: any) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2">{new Date(p.fechaDesde).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                    <td className="py-2">{new Date(p.fechaHasta).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                    <td className="py-2">{p.diasTomados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "francos" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">Generado</th>
                <th className="pb-2">Horas</th>
                <th className="pb-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {francos?.map((f) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="py-2">{new Date(f.fechaGenerado).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                  <td className="py-2">{f.horas}</td>
                  <td className="py-2">{f.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
