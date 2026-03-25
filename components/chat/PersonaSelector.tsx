/**
 * Persona Selector Component
 *
 * Allows users to switch between AI personas.
 * Displays available personas with avatars and descriptions.
 */

import { useCallback, useState } from "react";
import type { AIPersona } from "@/lib/ai/personas";

interface PersonaSelectorProps {
  personas: AIPersona[];
  currentPersonaSlug: string;
  onPersonaChange: (slug: string) => void;
  disabled?: boolean;
  variant?: "dropdown" | "radio" | "cards";
}

const PERSONA_ICONS: Record<string, string> = {
  default: "🤖",
  best_friend: "😏",
  girlfriend: "💕",
  gentle_teacher: "👩‍🏫",
  socrates: "🏛️",
  steve_jobs: "🎯",
  gordon: "👨‍🍳",
  clickbait: "📢",
};

const PERSONA_COLORS: Record<string, string> = {
  default: "bg-[var(--color-hover)] text-[var(--color-text-secondary)]",
  best_friend: "bg-[#f3f5f8] text-[#111827]",
  girlfriend: "bg-[#f3f5f8] text-[#111827]",
  gentle_teacher: "bg-[#f3f5f8] text-[#111827]",
  socrates: "bg-[#f3f5f8] text-[#111827]",
  steve_jobs: "bg-[#111827] text-white",
  gordon: "bg-[#f3f5f8] text-[#111827]",
  clickbait: "bg-[#f3f5f8] text-[#111827]",
};

export function PersonaSelector({
  personas,
  currentPersonaSlug,
  onPersonaChange,
  disabled = false,
  variant = "dropdown",
}: PersonaSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentPersona = personas.find((p) => p.slug === currentPersonaSlug) || personas[0];

  const handleSelect = useCallback(
    (slug: string) => {
      onPersonaChange(slug);
      setIsOpen(false);
    },
    [onPersonaChange],
  );

  if (variant === "cards") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {personas.map((persona) => (
          <button
            type="button"
            key={persona.id}
            onClick={() => handleSelect(persona.slug)}
            disabled={disabled}
            className={`
              p-3 rounded-lg border-2 transition-all text-left
              ${
                currentPersonaSlug === persona.slug
                  ? "border-[#111827] bg-[#f6f7f9]"
                  : "border-[var(--color-border)] hover:border-[#d1d7e0]"
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
            title={persona.description || undefined}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">
                {persona.avatar || PERSONA_ICONS[persona.slug] || "🤖"}
              </span>
              <span className="font-medium text-sm truncate text-[var(--color-text)]">
                {persona.name}
              </span>
            </div>
            {persona.description && (
              <p className="text-xs text-[var(--color-text-tertiary)] line-clamp-2">
                {persona.description}
              </p>
            )}
          </button>
        ))}
      </div>
    );
  }

  if (variant === "radio") {
    return (
      <div className="space-y-1">
        {personas.map((persona) => (
          <label
            key={persona.id}
            className={`
              flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all
              ${currentPersonaSlug === persona.slug ? "bg-[#f6f7f9]" : "hover:bg-[#f6f7f9]"}
              ${disabled ? "opacity-50 pointer-events-none" : ""}
            `}
          >
            <input
              type="radio"
              name="persona"
              value={persona.slug}
              checked={currentPersonaSlug === persona.slug}
              onChange={() => handleSelect(persona.slug)}
              disabled={disabled}
              className="h-4 w-4 text-[#111827]"
            />
            <span className="text-lg">{persona.avatar || PERSONA_ICONS[persona.slug] || "🤖"}</span>
            <div className="flex-1">
              <div className="font-medium text-sm text-[var(--color-text)]">{persona.name}</div>
              {persona.description && (
                <div className="text-xs text-[var(--color-text-tertiary)]">
                  {persona.description}
                </div>
              )}
            </div>
          </label>
        ))}
      </div>
    );
  }

  // Default dropdown variant
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.16)]
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          ${isOpen ? "border-[#111827] bg-[#f6f7f9]" : "border-[var(--color-border)] hover:border-[#d1d7e0]"}
          transition-colors
        `}
      >
        <span className="text-lg">
          {currentPersona?.avatar || PERSONA_ICONS[currentPersona?.slug || ""] || "🤖"}
        </span>
        <span className="font-medium text-sm text-[var(--color-text)]">{currentPersona?.name}</span>
        <svg
          className={`w-4 h-4 transition-transform text-[var(--color-text-muted)] ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          role="img"
          aria-label="Toggle dropdown"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default bg-transparent border-0"
            onClick={() => setIsOpen(false)}
            aria-label="Close dropdown"
          />
          <div className="absolute z-20 mt-2 max-h-80 w-56 overflow-y-auto rounded-2xl bg-white py-1 shadow-[0_24px_56px_-36px_rgba(15,23,42,0.18)]">
            {personas.map((persona) => (
              <button
                type="button"
                key={persona.id}
                onClick={() => handleSelect(persona.slug)}
                disabled={disabled}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
                  ${
                    currentPersonaSlug === persona.slug
                      ? "bg-[#f6f7f9] text-[#111827]"
                      : "hover:bg-[#f6f7f9]"
                  }
                  ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                <span className="text-lg">
                  {persona.avatar || PERSONA_ICONS[persona.slug] || "🤖"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate text-[var(--color-text)]">
                    {persona.name}
                  </div>
                  {persona.description && (
                    <div className="text-xs text-[var(--color-text-tertiary)] truncate">
                      {persona.description}
                    </div>
                  )}
                </div>
                {currentPersonaSlug === persona.slug && (
                  <svg
                    className="h-4 w-4 text-[#111827]"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    role="img"
                    aria-label="Selected"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Compact persona badge for inline display
 */
export function PersonaBadge({ persona, onClick }: { persona: AIPersona; onClick?: () => void }) {
  const colorClass =
    PERSONA_COLORS[persona.slug] || "bg-[var(--color-hover)] text-[var(--color-text-secondary)]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
        ${colorClass}
        ${onClick ? "cursor-pointer hover:opacity-80" : ""}
      `}
    >
      <span>{persona.avatar || PERSONA_ICONS[persona.slug] || "🤖"}</span>
      <span>{persona.name}</span>
    </button>
  );
}
