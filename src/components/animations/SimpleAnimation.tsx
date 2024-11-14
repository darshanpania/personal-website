// components/animations/SimpleAnimation.tsx
'use client';

import { ReactNode } from 'react';

interface SimpleAnimationProps {
  children: ReactNode;
  animation?: 'fade-up' | 'fade-down' | 'slide-left' | 'slide-right';
  delay?: number;
}

export const SimpleAnimation = ({ 
  children, 
  animation = 'fade-up',
  delay = 0 
}: SimpleAnimationProps) => {
  return (
    <div 
      className={`animate-${animation}`}
      style={{ 
        animationDelay: `${delay}s`,
        animationFillMode: 'forwards'
      }}
    >
      {children}
    </div>
  );
};