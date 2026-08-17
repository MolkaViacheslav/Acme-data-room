import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps extends React.ComponentProps<'input'> {
  readonly label: string;
  readonly name: string;
  readonly error?: string;
}

export function FormField({ label, name, error, className, ...inputProps }: FormFieldProps) {
  const errorId = `${name}-error`;

  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : errorId}
        className={cn(error !== undefined && 'border-destructive', className)}
        {...inputProps}
      />
      {error !== undefined && (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
