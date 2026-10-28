"use client";

import { useEffect, useState } from "react";

export interface VisualViewportBox {
  height: number;
  offsetTop: number;
}

function read(viewport: VisualViewport): VisualViewportBox {
  return {
    height: Math.round(viewport.height),
    offsetTop: Math.round(viewport.offsetTop),
  };
}

export function useVisualViewport(enabled: boolean): VisualViewportBox | null {
  const [box, setBox] = useState<VisualViewportBox | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!enabled || !viewport) return;
    const update = () => setBox(read(viewport));
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [enabled]);

  return enabled ? box : null;
}
