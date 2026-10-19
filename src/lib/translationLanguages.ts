/** Languages an article can be translated into. Plain data, shared by the screen and the server. */
export const TRANSLATION_LANGUAGES = [
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "zh", label: "Chinese (Simplified)" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
  { code: "id", label: "Indonesian" },
  { code: "vi", label: "Vietnamese" },
] as const;

export function languageLabel(code: string): string | null {
  return TRANSLATION_LANGUAGES.find((l) => l.code === code)?.label ?? null;
}

/** Scripts written right to left. */
export function isRightToLeft(code: string): boolean {
  return code === "ar";
}
