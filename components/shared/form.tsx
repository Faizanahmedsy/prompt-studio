"use client"

import { useId } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox, Switch } from "@/components/ui/misc"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/** Shared form controls. Nothing in the app uses a raw input or select. */

type FieldShell = {
  label?: string
  hint?: string
  className?: string
  children: React.ReactNode
  htmlFor?: string
}

function Field({ label, hint, className, children, htmlFor }: FieldShell) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function TextField({
  label,
  hint,
  className,
  ...props
}: React.ComponentProps<"input"> & { label?: string; hint?: string }) {
  const id = useId()
  return (
    <Field label={label} hint={hint} className={className} htmlFor={id}>
      <Input id={id} {...props} />
    </Field>
  )
}

export function TextAreaField({
  label,
  hint,
  className,
  ...props
}: React.ComponentProps<"textarea"> & { label?: string; hint?: string }) {
  const id = useId()
  return (
    <Field label={label} hint={hint} className={className} htmlFor={id}>
      <Textarea id={id} {...props} />
    </Field>
  )
}

export type Option = { value: string; label: string; description?: string }

export function SelectField({
  label,
  hint,
  className,
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  disabled,
}: {
  label?: string
  hint?: string
  className?: string
  value: string
  onValueChange: (value: string) => void
  options: Option[]
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

/** Native colour input plus a hex field — the one place native beats custom. */
export function ColorField({
  label,
  value,
  onChange,
  className,
}: {
  label?: string
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const id = useId()
  return (
    <Field label={label} className={className} htmlFor={id}>
      <div className="flex items-center gap-2">
        <span className="relative size-9 shrink-0 overflow-hidden rounded-md border border-input">
          <input
            id={id}
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="absolute -inset-2 h-[calc(100%+1rem)] w-[calc(100%+1rem)] cursor-pointer border-none bg-transparent p-0"
            aria-label={label ? `${label} colour` : "Colour"}
          />
        </span>
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          className="font-mono text-xs uppercase"
        />
      </div>
    </Field>
  )
}

export function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
  variant = "switch",
}: {
  title: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  variant?: "switch" | "checkbox"
}) {
  const id = useId()
  return (
    <div className="flex items-start gap-3 rounded-lg px-1 py-1.5 transition-colors hover:bg-muted/60">
      {variant === "switch" ? (
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          className="mt-0.5"
        />
      ) : (
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(next) => onCheckedChange(next === true)}
          className="mt-0.5"
        />
      )}
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer select-none">
        <span className="block text-xs font-medium leading-snug">{title}</span>
        {description && (
          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
            {description}
          </span>
        )}
      </label>
    </div>
  )
}
