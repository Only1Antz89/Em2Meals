"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
export function Pick({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Select
        value={value || "__empty"}
        onValueChange={(v) => {
          if (v) onChange(v === "__empty" ? "" : v);
        }}
      >
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {!options.some(
            (o) => (typeof o === "string" ? o : o.value) === "",
          ) && <SelectItem value="__empty">Select…</SelectItem>}
          {options.map((o) => {
            const v = typeof o === "string" ? o : o.value;
            return (
              <SelectItem key={v} value={v || "__empty"}>
                {typeof o === "string" ? o : o.label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </label>
  );
}
export function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  wide = false,
  min,
  step,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  wide?: boolean;
  min?: string | number;
  step?: string | number;
}) {
  return (
    <label className={"field " + (wide ? "wide" : "")}>
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <Input
        aria-label={label}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        min={min}
        step={step}
      />
    </label>
  );
}
export function Notes({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="field wide">
      <span>{label}</span>
      {hint && <small className="field-hint text-xs text-muted-foreground">{hint}</small>}
      <Textarea
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
      />
    </label>
  );
}
