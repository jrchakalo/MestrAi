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
  const onDoneRef = useRef(onDone);
  const onTickRef = useRef(onTick);

  useEffect(() => {
    onDoneRef.current = onDone;
    onTickRef.current = onTick;
  }, [onDone, onTick]);

  useEffect(() => {
    if (!enabled) {
      setDisplay(text);
      return;
    }

    if (!text) {
      setDisplay('');
      onDoneRef.current?.();
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
      onTickRef.current?.();
      if (indexRef.current >= text.length) {
        onDoneRef.current?.();
        return;
      }
      timer = window.setTimeout(step, speedMs);
    };

    timer = window.setTimeout(step, speedMs);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [text, enabled, speedMs]);

  return display;
};
