"use client";
import { useMemo, useState } from "react";

type EventItem = { id: string; titlu: string; dataStart: string; dataEnd?: string; tip?: string; descriere?: string; locatie?: string; judet?: string };

export default function PanouPrincipalPage() {
  // Placeholder calendar (month view) – can be extended later
  const today = new Date();
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date | null>(today);
  const events: EventItem[] = [];

  const grid = useMemo(() => {
    const year = current.getFullYear();
    const month = current.getMonth();
    const first = new Date(year, month, 1);
    const startDay = first.getDay() === 0 ? 7 : first.getDay();
    const start = new Date(year, month, 1 - (startDay - 1));
    return Array.from({ length: 42 }).map((_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [current]);

  function format(d: Date) {
    return d.toLocaleDateString("ro-RO");
  }

  const byDay = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const ev of events) {
      const key = ev.dataStart;
      map.set(key, [...(map.get(key) || []), ev]);
    }
    return map;
  }, [events]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Panou principal / Calendar</h1>
      <div className="flex items-center gap-2">
        <button className="border rounded px-3 py-1" onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() - 1, 1))}>{"<<"}</button>
        <div className="font-medium">
          {current.toLocaleDateString("ro-RO", { month: "long", year: "numeric" })}
        </div>
        <button className="border rounded px-3 py-1" onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() + 1, 1))}>{">>"}</button>
      </div>

      <div className="grid grid-cols-7 gap-2 select-none">
        {["L", "Ma", "Mi", "J", "V", "S", "D"].map((d) => (
          <div key={d} className="text-center text-sm text-gray-600">{d}</div>
        ))}
        {grid.map((d, idx) => {
          const isCurrentMonth = d.getMonth() === current.getMonth();
          const key = d.toISOString().slice(0, 10);
          const evs = byDay.get(key) || [];
          return (
            <button
              key={idx}
              onClick={() => setSelected(d)}
              className={`h-20 border rounded p-1 text-left ${isCurrentMonth ? "bg-white" : "bg-gray-50"} ${selected && d.toDateString() === selected.toDateString() ? "ring-2 ring-blue-600" : ""}`}
            >
              <div className="text-xs text-gray-600">{d.getDate()}</div>
              {evs.length > 0 && <div className="mt-1 text-[10px] px-1 rounded bg-blue-100 text-blue-800 inline-block">{evs.length} evenimente</div>}
            </button>
          );
        })}
      </div>

      <div className="border rounded p-3">
        <div className="font-medium mb-2">Evenimente în {selected ? format(selected) : ""}</div>
        <div className="text-sm text-gray-600">Nu există evenimente în perioada selectată.</div>
      </div>
    </div>
  );
}


