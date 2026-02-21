import React from 'react';
import type { ValidationResult } from '../../utils/validators';
import { formatEmailInput, validateEmail } from '../../utils/validators';
import ValidatedInput from './ValidatedInput';

type Tone = 'status' | 'neutral';

interface EmailFieldProps {
  label?: React.ReactNode;
  labelClassName?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  validation?: ValidationResult;
  showErrorWhenEmpty?: boolean;
  disabled?: boolean;
  placeholder?: string;
  messageVariant?: 'none' | 'below-invalid' | 'overlay-when-value';
  colorMode?: 'status' | 'blue';
  tone?: Tone;
  className?: string;
  inputClassName?: string;
  rightAdornment?: React.ReactNode;
}

const EmailField: React.FC<EmailFieldProps> = ({
  label = 'Correo',
  labelClassName,
  required = false,
  value,
  onChange,
  validation,
  showErrorWhenEmpty,
  disabled = false,
  placeholder,
  messageVariant,
  colorMode,
  tone,
  className,
  inputClassName,
  rightAdornment,
}) => {
  return (
    <ValidatedInput
      label={label}
      labelClassName={labelClassName}
      required={required}
      value={value}
      onChange={onChange}
      format={formatEmailInput}
      validate={validateEmail}
      validation={validation}
      showErrorWhenEmpty={showErrorWhenEmpty}
      disabled={disabled}
      placeholder={placeholder}
      type="email"
      messageVariant={messageVariant}
      colorMode={colorMode}
      tone={tone}
      className={className}
      inputClassName={inputClassName}
      rightAdornment={rightAdornment}
    />
  );
};

export default EmailField;
