"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { LanguageToggle } from "@/components/ui/language-toggle";
import type { Bilingual, MeetingWithRelations } from "@/lib/types";

const LABELS = {
  bn: { title: "সারসংক্ষেপ", points: "মূল আলোচনার বিষয়" },
  en: { title: "Summary", points: "Key Discussion Points" },
};

export function SummaryTab({ meeting }: { meeting: MeetingWithRelations }) {
  const [lang, setLang] = useState<"bn" | "en">("bn");
  const summaryRow = meeting.summary;

  const parsed = useMemo(() => {
    if (!summaryRow) return null;
    let summary: Bilingual<string>;
    try {
      summary = JSON.parse(summaryRow.summary);
    } catch {
      summary = { bn: "", en: summaryRow.summary };
    }
    // Older meetings (processed before bilingual support) stored key_points as
    // a flat string[] — normalize so both shapes render without crashing.
    const rawKeyPoints = summaryRow.key_points as unknown;
    const keyPoints: Bilingual<string[]> = Array.isArray(rawKeyPoints)
      ? { bn: rawKeyPoints as string[], en: rawKeyPoints as string[] }
      : (rawKeyPoints as Bilingual<string[]>) ?? { bn: [], en: [] };

    return { summary, keyPoints };
  }, [summaryRow]);

  if (!parsed) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          The AI summary will appear here once processing finishes.
        </CardContent>
      </Card>
    );
  }

  const { summary, keyPoints } = parsed;
  const copyText = [
    LABELS[lang].title,
    summary[lang],
    "",
    LABELS[lang].points,
    ...keyPoints[lang].map((k) => `- ${k}`),
  ].join("\n");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{LABELS[lang].title}</CardTitle>
        <div className="flex items-center gap-2">
          <LanguageToggle value={lang} onChange={setLang} />
          <CopyButton text={copyText} label={lang === "bn" ? "কপি" : "Copy"} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <p className="text-sm leading-relaxed text-foreground">{summary[lang]}</p>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-foreground">{LABELS[lang].points}</h4>
          <ul className="flex flex-col gap-1.5 text-sm text-foreground">
            {keyPoints[lang].map((k, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {k}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
