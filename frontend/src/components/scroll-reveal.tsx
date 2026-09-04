'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Lightweight scroll-reveal: fades + lifts children into view the first time
 * they enter the viewport. Pure IntersectionObserver — no animation library.
 * Respects prefers-reduced-motion (element is visible immediately).
 */
export function ScrollReveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'section' | 'li';
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={cn(
        'transition-all duration-700 ease-out will-change-transform',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0',
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}