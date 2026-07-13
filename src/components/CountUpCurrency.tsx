import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/debt";

export function CountUpCurrency({
  amount,
  duration = 800,
}: {
  amount: number;
  duration?: number;
}) {
  const [displayAmount, setDisplayAmount] = useState(0);

  useEffect(() => {
    const target = Number.isFinite(amount) ? amount : 0;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion || target === 0) {
      setDisplayAmount(target);
      return;
    }

    let frame = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayAmount(target * eased);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    setDisplayAmount(0);
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [amount, duration]);

  return <>{formatCurrency(displayAmount)}</>;
}
