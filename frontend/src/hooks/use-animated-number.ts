import { useEffect, useRef, useState } from 'react';

export function useAnimatedNumber(target: number, duration = 1000, enabled = true): number {
  const [current, setCurrent] = useState(0);
  const frameRef = useRef<number>();
  const startTimeRef = useRef<number>();
  const previousTarget = useRef(0);

  useEffect(() => {
    if (!enabled) { setCurrent(target); return; }
    const start = previousTarget.current;
    previousTarget.current = target;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - (startTimeRef.current || now);
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(start + (target - start) * eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration, enabled]);

  return current;
}
