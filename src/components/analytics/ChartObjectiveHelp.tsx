import { useEffect, useRef, useState } from 'react';

interface ChartObjectiveHelpProps {
  title?: string;
  objective: string;
}

export function ChartObjectiveHelp({
  title = 'Objetivo do gráfico',
  objective,
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

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-purple-300 bg-white text-xs font-bold text-purple-700 hover:bg-purple-50"
        aria-label="Mostrar objetivo do gráfico"
      >
        ?
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-20 w-72 rounded-lg border border-purple-200 bg-white p-3 text-xs text-gray-700 shadow-xl">
          <div className="mb-1 font-semibold text-purple-900">{title}</div>
          <div>{objective}</div>
        </div>
      )}
    </div>
  );
}
