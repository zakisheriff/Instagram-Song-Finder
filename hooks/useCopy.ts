"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { copyText } from "@/lib/clipboard";

const FEEDBACK_MS = 2000;

export type CopyState = { key: string; ok: boolean } | null;

/** Copies text and remembers, briefly, which button did it so it can show feedback. */
export function useCopy() {
  const [state, setState] = useState<CopyState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async (text: string, key: string) => {
    const ok = await copyText(text);
    if (timer.current) clearTimeout(timer.current);
    setState({ key, ok });
    timer.current = setTimeout(() => setState(null), FEEDBACK_MS);
    return ok;
  }, []);

  return { state, copy };
}
