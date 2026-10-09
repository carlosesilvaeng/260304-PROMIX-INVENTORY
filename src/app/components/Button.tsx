import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'success' | 'dangerOutline' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  loading = false, 
  children, 
  className = '',
  disabled,
  ...props 
}: ButtonProps) {
  const baseStyles = 'inline-flex min-h-11 items-center justify-center gap-2 rounded transition-all duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    primary: 'bg-[var(--ui-primary-2475c7)] text-white hover:bg-[var(--ui-primary-hover-1a5a9f)] active:bg-[var(--ui-primary-active-134578)]',
    secondary: 'bg-[var(--ui-background-f2f3f5)] text-[color:var(--ui-text-3b3a36)] hover:bg-[var(--ui-border-9d9b9a)] border border-[var(--ui-border-9d9b9a)]',
    outline: 'bg-[var(--ui-surface)] text-[color:var(--ui-text-3b3a36)] border border-[var(--ui-border-9d9b9a)] hover:bg-[var(--ui-background-f2f3f5)] active:bg-[var(--ui-hover-e6e8eb)]',
    ghost: 'bg-transparent text-[color:var(--ui-text-3b3a36)] hover:bg-[var(--ui-background-f2f3f5)]',
    success: 'bg-[#1D8F4E] text-white hover:bg-[#176F3E] active:bg-[#115A31]',
    dangerOutline: 'bg-[var(--ui-surface)] text-[#C94A4A] border border-[#C94A4A] hover:bg-[#FBEAEA] active:bg-[#F4D7D7]',
    destructive: 'bg-[#C94A4A] text-white hover:bg-[#a03838]'
  };
  
  const sizeStyles = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };
  
  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
}
