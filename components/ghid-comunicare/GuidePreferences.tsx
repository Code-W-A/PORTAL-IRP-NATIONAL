"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { GuideCategory } from "@/lib/ghid-comunicare/types";
import { errorMessage, useGuide } from "./shared";

type Preferences = {
  categories: GuideCategory[];
  favorites: string[] | null;
  categoryError: string;
  favoriteError: string;
  retry: () => void;
};

const GuidePreferences = createContext<Preferences>({
  categories: [], favorites: null, categoryError: "", favoriteError: "", retry: () => {},
});

export function GuidePreferencesProvider({ children }: { children: ReactNode }) {
  const guide = useGuide();
  const [attempt, setAttempt] = useState(0);
  const [catalog, setCatalog] = useState<{ guide: typeof guide; items: GuideCategory[]; error: string }>();
  const [saved, setSaved] = useState<{ guide: typeof guide; ids: string[] | null; error: string }>();

  useEffect(() => {
    if (!guide) return;
    const stopCategories = guide.watchCategories(
      items => setCatalog({ guide, items, error: "" }),
      error => setCatalog({ guide, items: [], error: errorMessage(error) }),
    );
    const stopFavorites = guide.watchFavorites(
      ids => setSaved(previous =>
        previous?.guide === guide && !previous.error && previous.ids?.length === ids.length
          && previous.ids.every((id, index) => id === ids[index])
          ? previous : { guide, ids, error: "" },
      ),
      error => setSaved({ guide, ids: null, error: errorMessage(error) }),
    );
    return () => { stopCategories(); stopFavorites(); };
  }, [guide, attempt]);

  return <GuidePreferences.Provider value={{
    categories: catalog?.guide === guide ? catalog.items : [],
    categoryError: catalog?.guide === guide ? catalog.error : "",
    favorites: saved?.guide === guide ? saved.ids : null,
    favoriteError: saved?.guide === guide ? saved.error : "",
    retry: () => setAttempt(value => value + 1),
  }}>{children}</GuidePreferences.Provider>;
}

export function useGuidePreferences() {
  return useContext(GuidePreferences);
}
