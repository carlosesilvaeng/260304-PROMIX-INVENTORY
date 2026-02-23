/**
 * StandardInput Component
 * Standardized input for required fields with validation states
 */

import React from 'react';

interface StandardInputProps {
  label: string;
  value: number | string | null | undefined;
  onChange: (value: number | string) => void;
  type?: 'number' | 'text';
  unit?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  helperText?: string;
  className?: string;
}

export function StandardInput({
  label,
  value,
  onChange,
  type = 'number',
  unit,
  required = true,
  disabled = false,
  placeholder,
  min,
  max,
  step,
  helperText,
  className = '',
}: StandardInputProps) {
  // Determine if field is incomplete (null, undefined, or empty string)
  // Note: 0 is a VALID value
  const isIncomplete = required && (value === null || value === undefined || value === '');
  const hasError = isIncomplete && !disabled;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    if (type === 'number') {
      // Allow empty string (user clearing the field)
      if (rawValue === '') {
        onChange('');
        return;
      }
      
      // Parse as number
      const numValue = parseFloat(rawValue);
      
      // Allow 0 as valid value
      if (!isNaN(numValue)) {
        onChange(numValue);
      }
    } else {
      onChange(rawValue);
    }
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {/* Label */}
      <label className="text-sm font-semibold text-[#3B3A36] flex items-center gap-1">
        {label}
        {required && (
          <span className="text-red-600" title="Campo requerido">*</span>
        )}
        {unit && (
          <span className="text-xs text-[#5F6773] font-normal ml-1">({unit})</span>
        )}
      </label>

      {/* Input */}
      <div className="relative">
        <input
          type={type === 'number' ? 'number' : 'text'}
          value={value ?? ''}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder || (required ? 'Requerido' : 'Opcional')}
          min={min}
          max={max}
          step={step}
          className={`
            w-full px-3 py-2.5 rounded
            text-base font-medium
            transition-all duration-200
            ${disabled 
              ? 'bg-[#F2F3F5] text-[#9D9B9A] cursor-not-allowed border-2 border-[#D4D2CF]' 
              : hasError
                ? 'bg-white text-[#3B3A36] border-2 border-red-500 focus:border-red-600 focus:ring-2 focus:ring-red-200'
                : 'bg-white text-[#3B3A36] border-2 border-[#D4D2CF] focus:border-[#2475C7] focus:ring-2 focus:ring-[#2475C7]/20'
            }
            outline-none
          `}
        />
        
        {/* Unit suffix inside input */}
        {unit && !disabled && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#5F6773] font-medium pointer-events-none">
            {unit}
          </div>
        )}
      </div>

      {/* Helper text or error message */}
      {helperText && !hasError && (
        <p className="text-xs text-[#5F6773]">{helperText}</p>
      )}
      
      {hasError && (
        <p className="text-xs text-red-600 font-medium">
          ⚠️ Este campo es requerido
        </p>
      )}
    </div>
  );
}

/**
 * ReadOnlyField Component
 * For displaying configuration data that should not be edited
 */

interface ReadOnlyFieldProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function ReadOnlyField({
  label,
  value,
  unit,
  icon,
  className = '',
}: ReadOnlyFieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {/* Label */}
      <label className="text-xs font-semibold text-[#5F6773] uppercase tracking-wide">
        {label}
      </label>

      {/* Read-only value */}
      <div className="
        flex items-center gap-2
        px-3 py-2.5 rounded
        bg-[#F2F3F5] border-2 border-[#E5E3E0]
        text-base font-bold text-[#3B3A36]
      ">
        {icon && <span className="text-[#5F6773]">{icon}</span>}
        <span className="flex-1">{value}</span>
        {unit && (
          <span className="text-sm text-[#5F6773] font-medium">{unit}</span>
        )}
      </div>
    </div>
  );
}

/**
 * FormSection Component
 * Container for grouping related inputs
 */

interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function FormSection({
  title,
  description,
  children,
  icon,
  className = '',
}: FormSectionProps) {
  return (
    <div className={`bg-white border-2 border-[#D4D2CF] rounded-lg p-4 ${className}`}>
      {/* Section header */}
      <div className="flex items-start gap-3 mb-4 pb-3 border-b-2 border-[#E5E3E0]">
        {icon && (
          <div className="text-2xl mt-0.5">{icon}</div>
        )}
        <div className="flex-1">
          <h3 className="text-lg font-bold text-[#3B3A36]">{title}</h3>
          {description && (
            <p className="text-sm text-[#5F6773] mt-0.5">{description}</p>
          )}
        </div>
      </div>

      {/* Section content */}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
