import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener("change", handler);
    return () => list.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/**
 * Мобильная раскладка включается не только по ширине, но и по типу указателя:
 * узкое окно на ПК с мышью остаётся «десктопным», планшет с пальцем — нет.
 */
export function useIsMobileLayout(): boolean {
  const narrow = useMediaQuery("(max-width: 767px)");
  const coarse = useMediaQuery("(pointer: coarse)");
  return narrow || coarse;
}
