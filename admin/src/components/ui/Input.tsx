import { forwardRef, InputHTMLAttributes, useState } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightAction?: React.ReactNode; // e.g. show/hide password button
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightAction, id, className = '', style, ...props }, ref) => {
    const [focused, setFocused] = useState(false);

    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <span
              className="absolute left-3 pointer-events-none"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={`
              w-full rounded-lg text-sm outline-none transition-[border-color,box-shadow]
              ${leftIcon ? 'pl-10' : 'pl-4'}
              ${rightAction ? 'pr-11' : 'pr-4'}
              py-2.5
              ${className}
            `}
            style={{
              background: 'var(--color-input-bg)',
              border: `1px solid ${error ? 'var(--color-danger)' : focused ? 'var(--color-input-border-focus)' : 'var(--color-input-border)'}`,
              boxShadow: focused && !error ? '0 0 0 3px rgba(22,163,74,0.12)' : error && focused ? '0 0 0 3px rgba(220,38,38,0.12)' : 'none',
              color: 'var(--color-text-primary)',
              ...style,
            }}
            onFocus={(e) => {
              setFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />

          {rightAction && (
            <span className="absolute right-3 flex items-center">
              {rightAction}
            </span>
          )}
        </div>

        {error && (
          <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
