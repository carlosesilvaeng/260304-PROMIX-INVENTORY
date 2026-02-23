import React from 'react';
import logo from 'figma:asset/43c8f56f43a42443b9c0ca35086add951dfbd691.png';

interface PromixLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'h-6',    // 24px
  md: 'h-8',    // 32px
  lg: 'h-12',   // 48px
  xl: 'h-16',   // 64px
};

export function PromixLogo({ size = 'md', className = '' }: PromixLogoProps) {
  return (
    <img 
      src={logo} 
      alt="PROMIX Concretos" 
      className={`${sizeClasses[size]} w-auto ${className}`}
    />
  );
}
