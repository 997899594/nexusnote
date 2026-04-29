import type { CallSettings } from "ai";
import { getModelNameForPolicy, type ModelPolicy } from "./model-policy";

type TunableGenerationSettings = Pick<
  CallSettings,
  | "frequencyPenalty"
  | "maxOutputTokens"
  | "presencePenalty"
  | "seed"
  | "stopSequences"
  | "temperature"
  | "topK"
  | "topP"
>;

export interface ModelGenerationCapabilities {
  model: string;
  supportsSamplingControls: boolean;
}

function normalizeModelName(model: string): string {
  return model.trim().toLowerCase();
}

function isOpenAIReasoningFamily(model: string): boolean {
  const normalized = normalizeModelName(model);
  return /(^|[/:\s])(?:gpt-5|o[1-9])(?:[.\-/:_\s]|$)/.test(normalized);
}

export function getGenerationCapabilitiesForPolicy(
  policy: ModelPolicy,
): ModelGenerationCapabilities {
  const model = getModelNameForPolicy(policy);

  return {
    model,
    supportsSamplingControls: !isOpenAIReasoningFamily(model),
  };
}

export function buildGenerationSettingsForPolicy(
  policy: ModelPolicy,
  settings: TunableGenerationSettings,
): TunableGenerationSettings {
  const capabilities = getGenerationCapabilitiesForPolicy(policy);

  if (capabilities.supportsSamplingControls) {
    return settings;
  }

  const {
    frequencyPenalty: _frequencyPenalty,
    presencePenalty: _presencePenalty,
    seed: _seed,
    temperature: _temperature,
    topK: _topK,
    topP: _topP,
    ...supportedSettings
  } = settings;

  return supportedSettings;
}
