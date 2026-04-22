"use client";

import { animate, useMotionValue, useTransform, motion } from "framer-motion";
import { useEffect } from "react";

export type AnimatedCounterProps = {
  value: number;
  className?: string;
};

const formatTokens = (n: number): string =>
  Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

export function AnimatedCounter({ value, className }: AnimatedCounterProps) {
  const motionValue = useMotionValue(value);
  const rounded = useTransform(motionValue, (n) => formatTokens(n));

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [motionValue, value]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
