"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { connectDemoIntegration, disconnectIntegration, updateIntegrationSettings } from "@/lib/actions/integrations";
import type { IntegrationProvider } from "@/lib/types";

export function IntegrationCard({
  provider,
  icon,
  name,
  description,
  connected,
  demo,
  configured,
  connectHref,
  settingsSchema,
  settings,
}: {
  provider: IntegrationProvider;
  icon: React.ReactNode;
  name: string;
  description: string;
  connected: boolean;
  demo: boolean;
  configured: boolean;
  connectHref: string;
  settingsSchema: { key: string; label: string }[];
  settings: Record<string, boolean>;
}) {
  const [, startTransition] = useTransition();

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-control bg-gray-100">{icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{name}</h3>
                {connected && (
                  <Badge variant="success">
                    <Check className="h-3 w-3" /> Connected{demo ? " (Demo)" : ""}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            </div>
          </div>

          {connected ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => startTransition(() => disconnectIntegration(provider))}
            >
              Disconnect
            </Button>
          ) : configured ? (
            <Button size="sm" asChild>
              <a href={connectHref}>Connect</a>
            </Button>
          ) : (
            <Button size="sm" onClick={() => startTransition(() => connectDemoIntegration(provider))}>
              Connect (Demo)
            </Button>
          )}
        </div>

        {connected && settingsSchema.length > 0 && (
          <div className="flex flex-col gap-2.5 border-t border-border pt-3">
            {settingsSchema.map((s) => (
              <div key={s.key} className="flex items-center justify-between">
                <Label htmlFor={`${provider}-${s.key}`} className="text-sm font-normal text-foreground">
                  {s.label}
                </Label>
                <Switch
                  id={`${provider}-${s.key}`}
                  defaultChecked={settings[s.key] ?? true}
                  onCheckedChange={(checked) =>
                    startTransition(() => updateIntegrationSettings(provider, { [s.key]: checked }))
                  }
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
