import { forwardRef, SelectHTMLAttributes, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  hint?: string;
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, hint, placeholder, id, className = '', style, ...props }, ref) => {
    const [focused, setFocused] = useState(false);

    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {label}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`
              w-full pl-4 pr-9 py-2.5 rounded-lg text-sm outline-none
              appearance-none cursor-pointer transition-[border-color,box-shadow]
              ${className}
            `}
            style={{
              background: 'var(--color-input-bg)',
              border: `1px solid ${error ? 'var(--color-danger)' : focused ? 'var(--color-input-border-focus)' : 'var(--color-input-border)'}`,
              boxShadow: focused && !error ? '0 0 0 3px rgba(22,163,74,0.12)' : 'none',
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
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <ChevronDown size={15} />
          </span>
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

Select.displayName = 'Select';
export default Select;
