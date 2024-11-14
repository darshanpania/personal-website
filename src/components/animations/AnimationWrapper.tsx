// components/animations/AnimationWrapper.tsx
'use client';

import { ReactNode, useEffect, useState, useRef } from 'react';

interface AnimationWrapperProps {
  children: ReactNode;
  animation: 'fade-up' | 'fade-down' | 'slide-left' | 'slide-right';
  delay?: number;
}

export const AnimationWrapper = ({ 
  children, 
  animation,
  delay = 0
}: AnimationWrapperProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setIsVisible(true);
        observer.disconnect(); // Stop observing once animation is triggered
      }
    }, {
      threshold: 0.1
    });

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div 
      ref={elementRef}
      className={`${isVisible ? `animate-${animation}` : 'opacity-0'}`}
      style={{ 
        animationDelay: `${delay}s`,
      }}
    >
      {children}
    </div>
  );
};