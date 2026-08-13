"use client";

import { useState, useTransition } from "react";
import { Sparkles, Check, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { updateSettingsSection } from "@/lib/actions/settings";
import type { AiProvider } from "@/lib/types";

const PROVIDERS: { value: AiProvider; label: string }[] = [
  { value: "gemini", label: "Gemini (Google)" },
  { value: "openai", label: "GPT (OpenAI)" },
  { value: "anthropic", label: "Claude (Anthropic)" },
];

const providerLabel = (p: AiProvider | null) => PROVIDERS.find((o) => o.value === p)?.label ?? p;

export function AiConfigCard({ aiConfig }: { aiConfig: { provider: AiProvider | null; hasKey: boolean } }) {
  const configured = Boolean(aiConfig.provider && aiConfig.hasKey);
  const [isEditing, setIsEditing] = useState(!configured);
  const [provider, setProvider] = useState<AiProvider>(aiConfig.provider ?? "gemini");
  const [apiKey, setApiKey] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    if (!apiKey.trim()) return;
    startTransition(async () => {
      await updateSettingsSection("aiConfig", { provider, apiKey: apiKey.trim() });
      setApiKey("");
      setIsEditing(false);
    });
  };

  const handleRemove = () => {
    startTransition(async () => {
      await updateSettingsSection("aiConfig", { provider: null, apiKey: null });
      setApiKey("");
      setProvider("gemini");
      setIsEditing(true);
    });
  };

  const handleCancel = () => {
    setProvider(aiConfig.provider ?? "gemini");
    setApiKey("");
    setIsEditing(false);
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-control bg-gray-100">
              <Sparkles className="h-5 w-5 text-primary" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">AI Configuration</h3>
                {configured && (
                  <Badge variant="success">
                    <Check className="h-3 w-3" /> Configured
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Choose which AI provider generates your meeting summaries and minutes.
              </p>
            </div>
          </div>
        </div>

        {!isEditing && configured ? (
          <div className="flex items-center justify-between border-t border-border pt-3">
            <div>
              <p className="text-sm font-medium text-foreground">{providerLabel(aiConfig.provider)}</p>
              <p className="text-xs text-muted-foreground">API key saved</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button size="sm" variant="secondary" disabled={isPending} onClick={handleRemove}>
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-normal text-foreground">Model</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as AiProvider)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ai-api-key" className="text-sm font-normal text-foreground">
                API Key
              </Label>
              <Input
                id="ai-api-key"
                type="password"
                autoComplete="off"
                placeholder={configured ? "•••••••••••••••• (enter a new key to replace)" : "Paste your API key"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              {configured && (
                <Button size="sm" variant="secondary" disabled={isPending} onClick={handleCancel}>
                  Cancel
                </Button>
              )}
              <Button size="sm" disabled={!apiKey.trim() || isPending} onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
