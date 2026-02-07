import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  isLoading,
  children, 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    primary: "bg-purple-600 text-white hover:bg-purple-700 shadow-sm",
    secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700",
    ghost: "hover:bg-slate-800 text-slate-300 hover:text-white",
    destructive: "bg-red-600 text-white hover:bg-red-700",
    outline: "border border-slate-600 bg-transparent hover:bg-slate-800 text-slate-200"
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 py-2",
    lg: "h-12 px-8 text-lg",
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <span className="mr-2 animate-spin">⏳</span>
      ) : null}
      {children}
    </button>
  );
};
