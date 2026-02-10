import { useEffect, useRef, useState } from 'react';

interface UseTypewriterOptions {
  enabled?: boolean;
  speedMs?: number;
  onDone?: () => void;
  onTick?: () => void;
}

export const useTypewriter = (
  text: string,
  { enabled = true, speedMs = 15, onDone, onTick }: UseTypewriterOptions = {}
) => {
  const [display, setDisplay] = useState(enabled ? '' : text);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setDisplay(text);
      return;
    }

    if (!text) {
      setDisplay('');
      onDone?.();
      return;
    }

    indexRef.current = 0;
    setDisplay('');
    let cancelled = false;
    let timer: number | undefined;

    const step = () => {
      if (cancelled) return;
      indexRef.current += 1;
      setDisplay(text.slice(0, indexRef.current));
      onTick?.();
      if (indexRef.current >= text.length) {
        onDone?.();
        return;
      }
      timer = window.setTimeout(step, speedMs);
    };

    timer = window.setTimeout(step, speedMs);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [text, enabled, speedMs, onDone, onTick]);

  return display;
};
