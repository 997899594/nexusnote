import type { AIPreferences } from "@/lib/ai/preferences";

interface LearningStyle {
  preferredFormat?: string;
  pace?: string;
}

export function buildExplicitPreferencePolicy({
  aiPreferences,
  learningStyle,
}: {
  aiPreferences: AIPreferences;
  learningStyle?: LearningStyle | null;
}): string {
  const lines = ["## Explicit User Preference Policy"];

  switch (aiPreferences.tone) {
    case "direct":
      lines.push("- Prefer direct wording and fast point-first answers.");
      break;
    case "gentle":
      lines.push("- Prefer warm, supportive phrasing while staying concrete.");
      break;
    default:
      lines.push("- Keep tone balanced, calm, and professional.");
      break;
  }

  switch (aiPreferences.depth) {
    case "concise":
      lines.push("- Keep replies concise unless the user explicitly asks for depth.");
      break;
    case "detailed":
      lines.push("- Include fuller reasoning, examples, and tradeoffs when useful.");
      break;
    default:
      lines.push("- Default to medium detail.");
      break;
  }

  switch (aiPreferences.teachingStyle) {
    case "coach":
      lines.push("- Teach like a coach: emphasize drills, corrections, and next actions.");
      break;
    case "socratic":
      lines.push("- Use guided questions when they help learning, but do not become evasive.");
      break;
    default:
      lines.push("- Explain concepts clearly before branching into alternatives.");
      break;
  }

  switch (aiPreferences.responseFormat) {
    case "structured":
      lines.push("- Prefer sections, bullets, and explicit structure.");
      break;
    case "conversational":
      lines.push("- Prefer natural conversational prose over rigid formatting.");
      break;
    default:
      lines.push("- Add structure only when it improves clarity.");
      break;
  }

  if (learningStyle?.preferredFormat) {
    lines.push(`- Preferred learning format: ${learningStyle.preferredFormat}.`);
  }

  if (learningStyle?.pace) {
    lines.push(`- Preferred learning pace: ${learningStyle.pace}.`);
  }

  return lines.join("\n");
}
