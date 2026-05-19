import type { CallSettings } from "ai";
import { getModelNameForPolicy, type ModelPolicy } from "./model-policy";
import type { AIModelSeries } from "./model-series";

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
  modelSeries?: AIModelSeries,
): ModelGenerationCapabilities {
  const model = getModelNameForPolicy(policy, { modelSeries });

  return {
    model,
    supportsSamplingControls: !isOpenAIReasoningFamily(model),
  };
}

export function buildGenerationSettingsForPolicy(
  policy: ModelPolicy,
  settings: TunableGenerationSettings,
  options?: {
    modelSeries?: AIModelSeries;
  },
): TunableGenerationSettings {
  const capabilities = getGenerationCapabilitiesForPolicy(policy, options?.modelSeries);

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
