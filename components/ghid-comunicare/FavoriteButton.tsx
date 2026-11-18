"use client";

import { Star } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useGuidePreferences } from "./GuidePreferences";
import { errorMessage, useGuide } from "./shared";

export function FavoriteButton({ id, active }: { id: string; active: boolean }) {
  const guide = useGuide();
  const { favorites } = useGuidePreferences();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const saved = favorites?.includes(id) ?? false;
  const label = saved ? "Scoate din favorite" : "Adaugă la favorite";

  async function toggle() {
    if (!guide || !favorites || lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      await guide.setFavorite(id, !saved);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  if (!active && !saved) return null;
  return <div className="shrink-0">
    <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={label}
      title={label} aria-pressed={saved} disabled={!favorites || pending} onClick={() => void toggle()}>
      <Star aria-hidden="true" className={saved ? "fill-amber-300 text-amber-700" : "text-slate-500"} />
    </Button>
    {error ? <p role="alert" className="max-w-48 text-sm text-red-700">{error}</p> : null}
  </div>;
}
