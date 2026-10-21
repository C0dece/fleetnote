import { useEffect, useState } from "react";

export interface ViewportInfo {
  /** Высота видимой области: при открытой клавиатуре меньше, чем innerHeight. */
  height: number;
  /** Сколько экрана занимает клавиатура. */
  keyboardHeight: number;
  keyboardOpen: boolean;
  offsetTop: number;
}

/**
 * `window.visualViewport` — единственный надёжный способ узнать высоту экранной
 * клавиатуры в WebView. На нём держится надклавиатурный тулбар разметки.
 */
export function useVisualViewport(): ViewportInfo {
  const [info, setInfo] = useState<ViewportInfo>(() => read());

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setInfo(read());
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);
    update();
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return info;
}

function read(): ViewportInfo {
  if (typeof window === "undefined") {
    return { height: 0, keyboardHeight: 0, keyboardOpen: false, offsetTop: 0 };
  }
  const viewport = window.visualViewport;
  const height = viewport?.height ?? window.innerHeight;
  const keyboardHeight = Math.max(0, window.innerHeight - height - (viewport?.offsetTop ?? 0));
  return {
    height,
    keyboardHeight,
    // порог 120px: отсекаем мелкие изменения вроде панели браузера
    keyboardOpen: keyboardHeight > 120,
    offsetTop: viewport?.offsetTop ?? 0,
  };
}
