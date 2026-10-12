import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
};

export function InputField({
  label,
  className,
  ...props
}: InputFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">
        {label}
      </span>
      <input {...props} className={cn("control-input", className)} />
    </label>
  );
}
