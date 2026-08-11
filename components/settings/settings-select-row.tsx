"use client";

import { useTransition } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { updateSettingsSection } from "@/lib/actions/settings";

export function SettingsSelectRow({
  section,
  field,
  label,
  defaultValue,
  options,
}: {
  section: "recording" | "ai" | "notifications";
  field: string;
  label: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  const [, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm font-normal text-foreground">{label}</Label>
      <Select
        defaultValue={defaultValue}
        onValueChange={(v) => startTransition(() => updateSettingsSection(section, { [field]: v }))}
      >
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
