/**
 * Skin Selector Component
 *
 * Allows users to switch between AI skins.
 * Displays available skins with avatars and descriptions.
 */

import { useState } from "react";
import type { AISkin } from "@/lib/ai/skin-contract";

interface SkinSelectorProps {
  skins: AISkin[];
  currentSkinSlug: string;
  onSkinChange: (slug: string) => void;
  disabled?: boolean;
  variant?: "dropdown" | "radio" | "cards";
}

export function SkinSelector({
  skins,
  currentSkinSlug,
  onSkinChange,
  disabled = false,
  variant = "dropdown",
}: SkinSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentSkin = skins.find((skin) => skin.slug === currentSkinSlug) || skins[0];

  const handleSelect = (slug: string) => {
    onSkinChange(slug);
    setIsOpen(false);
  };

  if (variant === "cards") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {skins.map((skin) => (
          <button
            type="button"
            key={skin.id}
            onClick={() => handleSelect(skin.slug)}
            disabled={disabled}
            className={`
              p-3 rounded-lg border-2 transition-all text-left
              ${
                currentSkinSlug === skin.slug
                  ? "border-[#111827] bg-[#f6f7f9]"
                  : "border-[var(--color-border)] hover:border-[#d1d7e0]"
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
            title={skin.description || undefined}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{skin.avatar || "🤖"}</span>
              <span className="font-medium text-sm truncate text-[var(--color-text)]">
                {skin.name}
              </span>
            </div>
            {skin.description && (
              <p className="text-xs text-[var(--color-text-tertiary)] line-clamp-2">
                {skin.description}
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
        {skins.map((skin) => (
          <label
            key={skin.id}
            className={`
              flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all
              ${currentSkinSlug === skin.slug ? "bg-[#f6f7f9]" : "hover:bg-[#f6f7f9]"}
              ${disabled ? "opacity-50 pointer-events-none" : ""}
            `}
          >
            <input
              type="radio"
              name="skin"
              value={skin.slug}
              checked={currentSkinSlug === skin.slug}
              onChange={() => handleSelect(skin.slug)}
              disabled={disabled}
              className="h-4 w-4 text-[#111827]"
            />
            <span className="text-lg">{skin.avatar || "🤖"}</span>
            <div className="flex-1">
              <div className="font-medium text-sm text-[var(--color-text)]">{skin.name}</div>
              {skin.description && (
                <div className="text-xs text-[var(--color-text-tertiary)]">{skin.description}</div>
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
        <span className="text-lg">{currentSkin?.avatar || "🤖"}</span>
        <span className="font-medium text-sm text-[var(--color-text)]">{currentSkin?.name}</span>
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
            {skins.map((skin) => (
              <button
                type="button"
                key={skin.id}
                onClick={() => handleSelect(skin.slug)}
                disabled={disabled}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
                  ${
                    currentSkinSlug === skin.slug
                      ? "bg-[#f6f7f9] text-[#111827]"
                      : "hover:bg-[#f6f7f9]"
                  }
                  ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                <span className="text-lg">{skin.avatar || "🤖"}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate text-[var(--color-text)]">
                    {skin.name}
                  </div>
                  {skin.description && (
                    <div className="text-xs text-[var(--color-text-tertiary)] truncate">
                      {skin.description}
                    </div>
                  )}
                </div>
                {currentSkinSlug === skin.slug && (
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
