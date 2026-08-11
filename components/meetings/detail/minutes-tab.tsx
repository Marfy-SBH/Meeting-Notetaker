"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { formatDuration } from "@/lib/utils";
import { meetingDateTime } from "@/lib/meeting-grouping";
import type { Bilingual, MeetingWithRelations, MinutesContent } from "@/lib/types";

const LABELS = {
  bn: {
    title: "মিটিং মিনিটস",
    info: "মিটিং তথ্য",
    date: "তারিখ",
    time: "সময়",
    duration: "সময়কাল",
    participants: "অংশগ্রহণকারী",
    agenda: "আলোচ্যসূচি",
    discussion: "আলোচনা",
    decisions: "সিদ্ধান্ত",
    actionItems: "করণীয়",
    copy: "কপি",
  },
  en: {
    title: "Meeting Minutes",
    info: "Meeting Information",
    date: "Date",
    time: "Time",
    duration: "Duration",
    participants: "Participants",
    agenda: "Agenda",
    discussion: "Discussion",
    decisions: "Decisions",
    actionItems: "Action Items",
    copy: "Copy Minutes",
  },
};

export function MinutesTab({ meeting }: { meeting: MeetingWithRelations }) {
  const [lang, setLang] = useState<"bn" | "en">("bn");
  const rawContent = meeting.minutes?.content as unknown;

  // Older meetings (processed before bilingual support) stored content as a
  // flat MinutesContent — normalize so both shapes render without crashing.
  const minutesRow =
    rawContent && typeof rawContent === "object" && "bn" in (rawContent as object)
      ? (rawContent as Bilingual<MinutesContent>)
      : rawContent
        ? { bn: rawContent as MinutesContent, en: rawContent as MinutesContent }
        : null;

  if (!minutesRow) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Meeting minutes will appear here once processing finishes.
        </CardContent>
      </Card>
    );
  }

  const t = LABELS[lang];
  const minutes = minutesRow[lang];
  const start = meetingDateTime(meeting);
  const participantNames = meeting.participants.map((p) => p.name).join(", ") || "—";

  const copyText = [
    t.info,
    `${t.date}: ${format(start, "MMMM d, yyyy")}`,
    `${t.time}: ${format(start, "h:mm a")}`,
    `${t.duration}: ${meeting.duration != null ? formatDuration(meeting.duration) : "—"}`,
    `${t.participants}: ${participantNames}`,
    "",
    t.agenda,
    ...minutes.agenda.map((a) => `- ${a}`),
    "",
    t.discussion,
    minutes.discussion,
    "",
    t.decisions,
    ...minutes.decisions.map((d) => `- ${d}`),
    "",
    t.actionItems,
    ...minutes.actionItems.map((a) => `- ${a}`),
  ].join("\n");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{t.title}</CardTitle>
        <div className="flex items-center gap-2">
          <LanguageToggle value={lang} onChange={setLang} />
          <CopyButton text={copyText} label={t.copy} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Section title={t.info}>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <Info label={t.date} value={format(start, "MMMM d, yyyy")} />
            <Info label={t.time} value={format(start, "h:mm a")} />
            <Info label={t.duration} value={meeting.duration != null ? formatDuration(meeting.duration) : "—"} />
            <Info label={t.participants} value={participantNames} />
          </dl>
        </Section>

        <Section title={t.agenda}>
          <ul className="flex flex-col gap-1.5 text-sm text-foreground">
            {minutes.agenda.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </Section>

        <Section title={t.discussion}>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{minutes.discussion}</p>
        </Section>

        <Section title={t.decisions}>
          <ul className="flex flex-col gap-1.5 text-sm text-foreground">
            {minutes.decisions.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </Section>

        <Section title={t.actionItems}>
          <ul className="flex flex-col gap-1.5 text-sm text-foreground">
            {minutes.actionItems.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </Section>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-foreground">{title}</h4>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
