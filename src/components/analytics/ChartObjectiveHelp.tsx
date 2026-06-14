import { CircleHelp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ChartObjectiveHelpProps {
  title?: string;
  objective: string;
  bLeft?: boolean;
}

export function ChartObjectiveHelp({
  title = 'Objetivo do grafico',
  objective,
  bLeft = false,
}: ChartObjectiveHelpProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const tooltipPosition = bLeft
    ? 'left-full top-1/2 ml-1 -translate-y-1/2'
    : 'left-1/2 top-full mt-1 -translate-x-1/2';

  return (
    <div className="relative inline-flex shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        aria-label={`Mostrar ajuda: ${title}`}
        aria-expanded={open}
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </button>

      {open && (
        <span
          role="tooltip"
          className={`absolute ${tooltipPosition} z-20 w-56 rounded-lg border border-slate-200 bg-white p-2.5 text-left text-[11px] leading-4 text-slate-600 shadow-xl`}
        >
          <span className="mb-1 block font-bold text-slate-900">{title}</span>
          {objective}
        </span>
      )}
    </div>
  );
}
