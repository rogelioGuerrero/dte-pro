import React from 'react';
import type { ValidationResult } from '../../utils/validators';
import { formatNitOrDuiInput, validateNIT } from '../../utils/validators';
import ValidatedInput from './ValidatedInput';

type Tone = 'status' | 'neutral';

interface NitOrDuiFieldProps {
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
  fontMono?: boolean;
  rightAdornment?: React.ReactNode;
}

const NitOrDuiField: React.FC<NitOrDuiFieldProps> = ({
  label = 'NIT / DUI',
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
      format={formatNitOrDuiInput}
      validate={validateNIT}
      validation={validation}
      showErrorWhenEmpty={showErrorWhenEmpty}
      disabled={disabled}
      placeholder={placeholder}
      messageVariant={messageVariant}
      colorMode={colorMode}
      tone={tone}
      className={className}
      inputClassName={inputClassName}
      fontMono={fontMono}
      rightAdornment={rightAdornment}
    />
  );
};

export default NitOrDuiField;
