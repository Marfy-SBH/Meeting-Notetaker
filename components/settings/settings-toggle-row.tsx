"use client";

import { useTransition } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateSettingsSection } from "@/lib/actions/settings";

export function SettingsToggleRow({
  section,
  field,
  label,
  defaultChecked,
}: {
  section: "recording" | "ai" | "notifications";
  field: string;
  label: string;
  defaultChecked: boolean;
}) {
  const [, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={`${section}-${field}`} className="text-sm font-normal text-foreground">
        {label}
      </Label>
      <Switch
        id={`${section}-${field}`}
        defaultChecked={defaultChecked}
        onCheckedChange={(checked) => startTransition(() => updateSettingsSection(section, { [field]: checked }))}
      />
    </div>
  );
}
