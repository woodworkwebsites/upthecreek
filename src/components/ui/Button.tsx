import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-bold tracking-wide transition-all duration-200 rounded-full focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100';

  const variants = {
    primary:
      'bg-navy-800 text-white hover:bg-navy-700 shadow-lg shadow-navy-900/20',
    secondary:
      'border-2 border-navy-800 text-navy-800 bg-transparent hover:bg-navy-800 hover:text-white',
    ghost:
      'text-gray-600 hover:text-navy-800 hover:bg-gray-100',
  };

  const sizes = {
    sm: 'px-5 py-2 text-xs tracking-widest',
    md: 'px-7 py-3 text-sm tracking-wider',
    lg: 'px-10 py-4 text-sm tracking-widest',
  };

  return (
    <button
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading && (
        <svg
          className="mr-2.5 h-3.5 w-3.5 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
