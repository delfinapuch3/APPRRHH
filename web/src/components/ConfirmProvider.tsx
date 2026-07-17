import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface ConfirmOptions {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  peligro?: boolean; // botón de confirmar en rojo, para acciones destructivas
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Provee un diálogo de confirmación con la estética de la app. Envolver la app
 * con <ConfirmProvider> y usar el hook useConfirm() para pedir confirmación
 * antes de acciones importantes o destructivas:
 *
 *   const confirmar = useConfirm();
 *   if (await confirmar({ titulo: "...", mensaje: "...", peligro: true })) { ... }
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null);

  const confirmar = useCallback<ConfirmFn>((options) => {
    setOpts(options);
    return new Promise<boolean>((resolve) => {
      setResolver(() => resolve);
    });
  }, []);

  function cerrar(valor: boolean) {
    resolver?.(valor);
    setResolver(null);
    setOpts(null);
  }

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {opts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]" onClick={() => cerrar(false)}>
          <div className="card p-6 w-full max-w-md" style={{ boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading font-bold text-lg text-ink-primary mb-2">{opts.titulo}</h3>
            <p className="text-sm text-ink-secondary mb-5">{opts.mensaje}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => cerrar(false)} className="btn-secondary">
                {opts.textoCancelar ?? "Cancelar"}
              </button>
              <button
                onClick={() => cerrar(true)}
                className={opts.peligro ? "btn-primary" : "btn-primary"}
                style={opts.peligro ? { background: "var(--status-rep)", boxShadow: "0 1px 3px rgba(220,38,38,.3)" } : undefined}
              >
                {opts.textoConfirmar ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm debe usarse dentro de ConfirmProvider");
  return ctx;
}
