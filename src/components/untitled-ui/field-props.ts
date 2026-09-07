export type FieldProps = {
  label: string;
  name: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  description?: string;
  error?: string;
  className?: string;
};
