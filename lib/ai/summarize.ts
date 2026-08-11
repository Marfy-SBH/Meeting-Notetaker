// Single point of contact with the LLM provider. Swap providers here only —
// nothing outside this file should import an AI SDK directly.
import { GoogleGenAI } from "@google/genai";

// "gemini-2.5-flash" was retired for new API keys; the "-latest" alias tracks
// whatever the current low-cost flash model is without needing code changes.
const MODEL = "gemini-flash-latest";

let client: GoogleGenAI | null = null;
function getClient() {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export interface TranscriptLine {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

export interface Bilingual<T> {
  bn: T;
  en: T;
}

export interface MinutesContent {
  agenda: string[];
  discussion: string;
  decisions: string[];
  actionItems: string[];
}

export interface MeetingAnalysis {
  summary: Bilingual<string>;
  keyPoints: Bilingual<string[]>;
  minutes: Bilingual<MinutesContent>;
  // Structured records (used by the action_items / decisions tables and the
  // Overview/Recording timestamp-jump features) stay single-language — English,
  // since assignees/due dates and jump targets don't need a translated copy.
  decisions: { text: string; timestamp: number | null }[];
  actionItems: { task: string; assignee: string | null; dueDate: string | null }[];
  importantMoments: { timestamp: number; title: string; description: string }[];
}

function transcriptToText(lines: TranscriptLine[]): string {
  return lines.map((l) => `[${formatTs(l.start)}] ${l.speaker}: ${l.text}`).join("\n");
}

function formatTs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SYSTEM_INSTRUCTION = `You are a professional meeting-notes editor for a Bangla/English/Banglish-speaking team. Your notes are read by busy people who need to scan them fast, so you write with a strict, consistent structure — never a wall of text.

Rules for every piece of writing you produce:
- Summary: 3-5 sentences, plain prose, no bullet points. State what the meeting was about, what was discussed, and the overall outcome — in that order.
- Key points: short, scannable phrases (3-8 words each), one concrete idea per point. Never repeat the summary verbatim.
- Meeting minutes "discussion": 1-3 short paragraphs (blank line between paragraphs), organized in the order topics came up. No bullet points inside this field — the agenda/decisions/action items bullets already cover structure.
- Agenda: reconstruct it from what was actually discussed, as short topic phrases, in the order they were covered.
- Decisions and action items inside minutes: short, complete-sentence bullets — each one understandable on its own without reading the rest.
- Never invent content that is not supported by the transcript. If something is genuinely absent (e.g. no decisions were made), return an empty list/array for it rather than inventing filler.

You are also fully bilingual. Every text field you produce must be given in BOTH natural, fluent Bangla (bn) and natural, fluent English (en) — never a literal word-by-word translation, and never mixed. Write each language as a native speaker of that language would write meeting notes, matching the same meaning and level of detail in both.`;

const ANALYSIS_SCHEMA_HINT = `Return ONLY valid JSON matching this exact shape, no markdown fences, no commentary:
{
  "summary": { "bn": string, "en": string },
  "keyPoints": { "bn": string[], "en": string[] },
  "minutes": {
    "bn": { "agenda": string[], "discussion": string, "decisions": string[], "actionItems": string[] },
    "en": { "agenda": string[], "discussion": string, "decisions": string[], "actionItems": string[] }
  },
  "decisions": [{ "text": string, "timestamp": number|null }],
  "actionItems": [{ "task": string, "assignee": string|null, "dueDate": string|null (YYYY-MM-DD or null) }],
  "importantMoments": [{ "timestamp": number, "title": string, "description": string }]
}
"decisions", "actionItems", and "importantMoments" (top-level, outside "minutes") are in English only.
Timestamps are in seconds from meeting start, taken from the [m:ss] markers in the transcript.`;

export async function analyzeMeeting(
  lines: TranscriptLine[],
  opts?: { meetingTitle?: string; summaryLength?: "brief" | "standard" | "detailed" }
): Promise<MeetingAnalysis> {
  const transcript = transcriptToText(lines);
  const lengthHint =
    opts?.summaryLength === "brief"
      ? "Keep the summary to 2 sentences in each language."
      : opts?.summaryLength === "detailed"
        ? "Write a thorough summary (multiple sentences, still one tight paragraph) in each language."
        : "Keep the summary to 3-5 sentences in each language.";

  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: `Analyze the transcript of a meeting titled "${opts?.meetingTitle ?? "Untitled Meeting"}".
${lengthHint}
Extract key discussion points, decisions made, action items (with assignee and due date if mentioned), and important moments worth jumping back to. Also produce structured meeting minutes.

${ANALYSIS_SCHEMA_HINT}

Transcript:
${transcript}`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
    },
  });

  return parseAnalysis(response.text ?? "");
}

const EMPTY_MINUTES: MinutesContent = { agenda: [], discussion: "", decisions: [], actionItems: [] };

function parseAnalysis(raw: string): MeetingAnalysis {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  return {
    summary: parsed.summary ?? { bn: "", en: "" },
    keyPoints: parsed.keyPoints ?? { bn: [], en: [] },
    minutes: parsed.minutes ?? { bn: EMPTY_MINUTES, en: EMPTY_MINUTES },
    decisions: parsed.decisions ?? [],
    actionItems: parsed.actionItems ?? [],
    importantMoments: parsed.importantMoments ?? [],
  };
}
