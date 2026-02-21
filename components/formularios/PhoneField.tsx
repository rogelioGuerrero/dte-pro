import React from 'react';
import type { ValidationResult } from '../../utils/validators';
import { formatPhoneInput, validatePhone } from '../../utils/validators';
import ValidatedInput from './ValidatedInput';

type Tone = 'status' | 'neutral';

interface PhoneFieldProps {
  label?: React.ReactNode;
  labelClassName?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  validation?: ValidationResult;
  showErrorWhenEmpty?: boolean;
  disabled?: boolean;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  messageVariant?: 'none' | 'below-invalid' | 'overlay-when-value';
  colorMode?: 'status' | 'blue';
  tone?: Tone;
  className?: string;
  inputClassName?: string;
  fontMono?: boolean;
  rightAdornment?: React.ReactNode;
}

const PhoneField: React.FC<PhoneFieldProps> = ({
  label = 'Teléfono',
  labelClassName,
  required = false,
  value,
  onChange,
  validation,
  showErrorWhenEmpty,
  disabled = false,
  placeholder,
  type = 'text',
  messageVariant,
  colorMode,
  tone,
  className,
  inputClassName,
  fontMono = true,
  rightAdornment,
}) => {
  return (
    <ValidatedInput
      label={label}
      labelClassName={labelClassName}
      required={required}
      value={value}
      onChange={onChange}
      format={formatPhoneInput}
      validate={validatePhone}
      validation={validation}
      showErrorWhenEmpty={showErrorWhenEmpty}
      disabled={disabled}
      placeholder={placeholder}
      type={type}
      messageVariant={messageVariant}
      colorMode={colorMode}
      tone={tone}
      className={className}
      inputClassName={inputClassName}
      fontMono={fontMono}
      inputMode="numeric"
      rightAdornment={rightAdornment}
    />
  );
};

export default PhoneField;
