import { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'danger' | 'ghost';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?:    Size;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-[#00e5ff]/10 border border-[#00e5ff] text-[#00e5ff] hover:bg-[#00e5ff]/20 glow-cyan',
  danger:  'bg-[#ff4d6a]/10 border border-[#ff4d6a] text-[#ff4d6a] hover:bg-[#ff4d6a]/20',
  ghost:   'bg-transparent border border-[#1a2840] text-gray-300 hover:border-[#00e5ff] hover:text-[#00e5ff]',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
};

export default function Button({
  variant = 'primary',
  size    = 'md',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-lg font-mono font-bold tracking-wider transition-all duration-150',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
