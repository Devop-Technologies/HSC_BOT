import { forwardRef, ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--color-accent)',
    color: '#fff',
    border: '1px solid transparent',
  },
  secondary: {
    background: 'var(--color-accent-subtle)',
    color: 'var(--color-accent)',
    border: '1px solid transparent',
  },
  danger: {
    background: 'var(--color-danger-bg)',
    color: 'var(--color-danger)',
    border: '1px solid transparent',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    border: '1px solid transparent',
  },
  outline: {
    background: 'transparent',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-card-border)',
  },
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
};

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path
        fill="currentColor"
        className="opacity-75"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center font-medium rounded-lg
          transition-opacity cursor-pointer select-none
          disabled:opacity-50 disabled:cursor-not-allowed
          ${sizeClasses[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        style={{ ...variantStyles[variant], ...style }}
        {...props}
      >
        {loading ? <SpinnerIcon /> : leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
