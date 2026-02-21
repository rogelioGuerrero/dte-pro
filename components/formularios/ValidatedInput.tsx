import React from 'react';
import type { ValidationResult } from '../../utils/validators';

type MessageVariant = 'none' | 'below-invalid' | 'overlay-when-value';
type ColorMode = 'status' | 'blue';
type Tone = 'status' | 'neutral';

interface ValidatedInputProps {
  label?: React.ReactNode;
  labelClassName?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  format?: (value: string) => string;
  validate?: (value: string) => ValidationResult;
  validation?: ValidationResult;
  showErrorWhenEmpty?: boolean;
  disabled?: boolean;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  className?: string;
  inputClassName?: string;
  messageVariant?: MessageVariant;
  colorMode?: ColorMode;
  tone?: Tone;
  fontMono?: boolean;
  rightAdornment?: React.ReactNode;
}

const ValidatedInput: React.FC<ValidatedInputProps> = ({
  label,
  labelClassName = 'block text-xs font-medium text-gray-500 uppercase mb-1',
  required = false,
  value,
  onChange,
  format,
  validate,
  validation,
  showErrorWhenEmpty = false,
  disabled = false,
  placeholder,
  type = 'text',
  inputMode,
  className,
  inputClassName,
  messageVariant = 'none',
  colorMode = 'blue',
  tone = 'status',
  fontMono = false,
  rightAdornment,
}) => {
  const hasValue = !!value;
  const computed = validate ? validate(value) : { valid: true, message: '' };
  const v = validation
    ? !validation.valid
      ? validation
      : validation.message
        ? validation
        : computed
    : computed;

  const considerValidationState = hasValue || showErrorWhenEmpty;

  const borderClass = considerValidationState
    ? v.valid
      ? tone === 'neutral'
        ? 'border-gray-300'
        : 'border-green-300'
      : 'border-red-300'
    : 'border-gray-300';

  const focusRingClass = colorMode === 'status' && considerValidationState
    ? v.valid
      ? 'focus:ring-green-500'
      : 'focus:ring-red-500'
    : 'focus:ring-blue-500';

  const shouldShowOverlay =
    messageVariant === 'overlay-when-value' &&
    considerValidationState &&
    !rightAdornment &&
    !!v.message;
  const shouldShowBelow =
    messageVariant === 'below-invalid' && considerValidationState && !v.valid && !!v.message;

  return (
    <div className={className}>
      {label && (
        <label className={labelClassName}>
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(e) => {
            const next = format ? format(e.target.value) : e.target.value;
            onChange(next);
          }}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-600 disabled:cursor-not-allowed focus:ring-2 outline-none ${borderClass} ${focusRingClass} ${fontMono ? 'font-mono' : ''} ${rightAdornment ? 'pr-10' : ''} ${inputClassName || ''}`}
        />
        {rightAdornment && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightAdornment}
          </div>
        )}
        {shouldShowOverlay && (
          <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium ${v.valid ? 'text-green-600' : 'text-red-500'}`}>
            {v.message}
          </span>
        )}
      </div>
      {shouldShowBelow && <p className="mt-1 text-xs text-red-500">{v.message}</p>}
    </div>
  );
};

export default ValidatedInput;
