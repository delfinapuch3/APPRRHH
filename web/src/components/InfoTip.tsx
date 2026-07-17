import { useEffect, useRef, useState } from "react";

/**
 * Ícono de información (una "i") con una explicación breve de qué hace o para
 * qué sirve la función/sección/campo al lado del que se coloca.
 *
 * Se muestra al pasar el mouse por encima y también al hacer click/tap (para
 * que funcione en celulares, donde no hay hover).
 *
 * Uso: <InfoTip texto="Explicación de la función." />
 */
export function InfoTip({ texto }: { texto: string }) {
  const [abierto, setAbierto] = useState(false);
  const [hover, setHover] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Cerrar el popover al hacer click fuera.
  useEffect(() => {
    if (!abierto) return;
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, [abierto]);

  const visible = abierto || hover;

  return (
    <span ref={ref} className="relative inline-flex align-middle" style={{ lineHeight: 0 }}>
      <button
        type="button"
        aria-label="Ver explicación"
        aria-expanded={visible}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAbierto((v) => !v);
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-ink-muted/50 text-ink-muted hover:text-brand-dark hover:border-brand-dark transition"
        style={{ background: "none", cursor: "pointer", fontSize: 10, fontStyle: "italic", fontWeight: 700, fontFamily: "Georgia, serif" }}
      >
        i
      </button>
      {visible && (
        <span
          role="tooltip"
          className="absolute z-50 left-1/2 -translate-x-1/2 top-6 w-64 max-w-[min(16rem,80vw)] rounded-lg bg-sidebar-bg text-slate-100 text-xs leading-relaxed p-3 shadow-lg"
          style={{ boxShadow: "var(--shadow-lg)", fontStyle: "normal", fontWeight: 400 }}
        >
          {texto}
        </span>
      )}
    </span>
  );
}
