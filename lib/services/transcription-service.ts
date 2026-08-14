import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";
import type { TranscriptLine } from "@/lib/ai/summarize";
import { toPlainError } from "@/lib/errors";

// Gemini natively handles audio input with strong multilingual coverage
// (Bangla/English/Banglish), unlike Deepgram's nova-2 which is English-only.
const MODEL = "gemini-flash-latest";
const FILE_READY_TIMEOUT_MS = 60_000;
const FILE_READY_POLL_MS = 2_000;

const TRANSCRIPT_PROMPT = `Transcribe this meeting recording verbatim. The speakers may mix Bangla, English, and Banglish (Bangla written with English words/phrases) — transcribe each segment in whatever language/script it was actually spoken in, do not translate.

Identify distinct speakers as "Speaker 1", "Speaker 2", etc. based on voice changes (best effort — if you can't distinguish speakers, use "Speaker 1" for everything).

Return ONLY a JSON array, no markdown fences, no commentary, matching this exact shape:
[{ "speaker": string, "start": number, "end": number, "text": string }]

"start" and "end" are in seconds from the beginning of the recording. If the recording has no discernible speech, return [].`;

let client: GoogleGenAI | null = null;
function getClient() {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

// Post-meeting, batch transcription only — never called during a live meeting.
export class TranscriptionService {
  // Not reachable from a client-invoked Server Action today (only the
  // Inngest background job calls this) — wrapped anyway so that stays true
  // if this is ever called from one, and so failures are readable either way.
  async transcribe(audioUrl: string): Promise<TranscriptLine[]> {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("No transcription provider configured (GEMINI_API_KEY)");
      }

      const audioResponse = await fetch(audioUrl);
      const mimeType = audioResponse.headers.get("content-type") || "audio/webm";
      const audioBlob = await audioResponse.blob();

      const ai = getClient();
      let file = await ai.files.upload({ file: audioBlob, config: { mimeType } });
      file = await this.waitUntilReady(file.name!);

      const response = await ai.models.generateContent({
        model: MODEL,
        contents: createUserContent([createPartFromUri(file.uri!, file.mimeType!), TRANSCRIPT_PROMPT]),
        config: { responseMimeType: "application/json" },
      });

      return this.parseTranscript(response.text ?? "[]");
    } catch (err) {
      throw toPlainError(err, "Transcription failed.");
    }
  }

  private async waitUntilReady(fileName: string) {
    const ai = getClient();
    const deadline = Date.now() + FILE_READY_TIMEOUT_MS;
    let file = await ai.files.get({ name: fileName });

    while (file.state === "PROCESSING") {
      if (Date.now() > deadline) throw new Error("Gemini file processing timed out");
      await new Promise((r) => setTimeout(r, FILE_READY_POLL_MS));
      file = await ai.files.get({ name: fileName });
    }

    if (file.state === "FAILED") throw new Error("Gemini failed to process the uploaded audio file");
    return file;
  }

  private parseTranscript(raw: string): TranscriptLine[] {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch (err) {
      throw toPlainError(err, "The transcription provider returned a response that couldn't be parsed as JSON.");
    }
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((seg) => seg && typeof seg.text === "string" && seg.text.trim().length > 0)
      .map((seg) => ({
        speaker: seg.speaker ?? "Speaker 1",
        start: Number(seg.start) || 0,
        end: Number(seg.end) || 0,
        text: seg.text.trim(),
      }));
  }
}
