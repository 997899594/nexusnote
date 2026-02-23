/**
 * Persona Selector Component
 *
 * Allows users to switch between AI personas.
 * Displays available personas with avatars and descriptions.
 */

import { useState, useCallback } from "react";
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
  default: "bg-gray-100 text-gray-700",
  best_friend: "bg-orange-100 text-orange-700",
  girlfriend: "bg-pink-100 text-pink-700",
  gentle_teacher: "bg-green-100 text-green-700",
  socrates: "bg-purple-100 text-purple-700",
  steve_jobs: "bg-black text-white",
  gordon: "bg-red-100 text-red-700",
  clickbait: "bg-yellow-100 text-yellow-700",
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
            key={persona.id}
            onClick={() => handleSelect(persona.slug)}
            disabled={disabled}
            className={`
              p-3 rounded-lg border-2 transition-all text-left
              ${currentPersonaSlug === persona.slug
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
            title={persona.description || undefined}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">
                {persona.avatar || PERSONA_ICONS[persona.slug] || "🤖"}
              </span>
              <span className="font-medium text-sm truncate">{persona.name}</span>
            </div>
            {persona.description && (
              <p className="text-xs text-gray-500 line-clamp-2">
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
              ${currentPersonaSlug === persona.slug
                ? "bg-blue-50"
                : "hover:bg-gray-50"
              }
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
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-lg">
              {persona.avatar || PERSONA_ICONS[persona.slug] || "🤖"}
            </span>
            <div className="flex-1">
              <div className="font-medium text-sm">{persona.name}</div>
              {persona.description && (
                <div className="text-xs text-gray-500">{persona.description}</div>
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
          flex items-center gap-2 px-3 py-2 rounded-lg border
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          ${isOpen ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}
          transition-colors
        `}
      >
        <span className="text-lg">
          {currentPersona?.avatar || PERSONA_ICONS[currentPersona?.slug || ""] || "🤖"}
        </span>
        <span className="font-medium text-sm">{currentPersona?.name}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 max-h-80 overflow-y-auto">
            {personas.map((persona) => (
              <button
                key={persona.id}
                onClick={() => handleSelect(persona.slug)}
                disabled={disabled}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
                  ${currentPersonaSlug === persona.slug
                    ? "bg-blue-50 text-blue-700"
                    : "hover:bg-gray-50"
                  }
                  ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                <span className="text-lg">
                  {persona.avatar || PERSONA_ICONS[persona.slug] || "🤖"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{persona.name}</div>
                  {persona.description && (
                    <div className="text-xs text-gray-500 truncate">
                      {persona.description}
                    </div>
                  )}
                </div>
                {currentPersonaSlug === persona.slug && (
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
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
export function PersonaBadge({
  persona,
  onClick,
}: {
  persona: AIPersona;
  onClick?: () => void;
}) {
  const colorClass = PERSONA_COLORS[persona.slug] || "bg-gray-100 text-gray-700";

  return (
    <button
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
