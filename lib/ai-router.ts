import { generateText, streamText } from "ai";
import { google } from "@ai-sdk/google";
import { createOpenAI, openai } from "@ai-sdk/openai";
import type { AccessibleModel } from "@/lib/model-access";

type AiMessages = any[];

type Candidate = {
  source: "primary" | "openrouter" | "groq" | "litellm" | "openai-compatible";
  provider: string;
  model: string;
  label: string;
  languageModel: any;
};

type RouterParams = {
  selectedModel: AccessibleModel;
  messages: AiMessages;
  maxOutputTokens: number;
  requiresVision?: boolean;
};

export type AiRouterResult = {
  text: string;
  provider: string;
  model: string;
  source: Candidate["source"];
  fallbackUsed: boolean;
  usage?: unknown;
};

export type AiRouterStreamEvent =
  | {
      type: "delta";
      textDelta: string;
    }
  | {
      type: "finish";
      text: string;
      provider: string;
      model: string;
      source: Candidate["source"];
      fallbackUsed: boolean;
    };

function splitEnvList(value?: string | null) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isEnabled(value?: string | null) {
  return ["1", "true", "yes", "on"].includes((value || "").toLowerCase());
}

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://aisitiki.vn"
  );
}

function getOpenRouterModel(model: string) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("Thiếu OPENROUTER_API_KEY.");
  }

  const openrouter = createOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      "HTTP-Referer": getSiteUrl(),
      "X-Title": process.env.OPENROUTER_APP_TITLE || "AI SITIKI",
    },
  });

  return openrouter(model);
}

function getGroqModel(model: string) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Thiếu GROQ_API_KEY.");
  }

  const groq = createOpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });

  return groq(model);
}

function getLiteLLMModel(model: string) {
  if (!process.env.LITELLM_BASE_URL || !process.env.LITELLM_API_KEY) {
    throw new Error("Thiếu LITELLM_BASE_URL hoặc LITELLM_API_KEY.");
  }

  const litellm = createOpenAI({
    apiKey: process.env.LITELLM_API_KEY,
    baseURL: process.env.LITELLM_BASE_URL.replace(/\/$/, ""),
  });

  return litellm(model);
}

function getOpenAICompatibleModel(model: string) {
  if (
    !process.env.OPENAI_COMPATIBLE_BASE_URL ||
    !process.env.OPENAI_COMPATIBLE_API_KEY
  ) {
    throw new Error(
      "Thiếu OPENAI_COMPATIBLE_BASE_URL hoặc OPENAI_COMPATIBLE_API_KEY.",
    );
  }

  const compatible = createOpenAI({
    apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
    baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL.replace(/\/$/, ""),
  });

  return compatible(model);
}

export function getPrimaryAiModel(selectedModel: AccessibleModel) {
  const provider = selectedModel.provider.toLowerCase().trim();

  if (provider === "google" || provider === "gemini") {
    return google(selectedModel.model);
  }

  if (provider === "openai") {
    return openai(selectedModel.model);
  }

  if (provider === "openrouter") {
    return getOpenRouterModel(selectedModel.model);
  }

  if (provider === "groq") {
    return getGroqModel(selectedModel.model);
  }

  if (provider === "litellm") {
    return getLiteLLMModel(selectedModel.model);
  }

  if (provider === "openai-compatible" || provider === "compatible") {
    return getOpenAICompatibleModel(selectedModel.model);
  }

  throw new Error(`Provider AI chưa được hỗ trợ: ${selectedModel.provider}`);
}

function createPrimaryCandidate(selectedModel: AccessibleModel): Candidate {
  return {
    source: "primary",
    provider: selectedModel.provider,
    model: selectedModel.model,
    label: `${selectedModel.provider}:${selectedModel.model}`,
    languageModel: getPrimaryAiModel(selectedModel),
  };
}

function getFreeProviderOrder() {
  const configured = splitEnvList(process.env.FREE_AI_PROVIDER_ORDER);

  return configured.length > 0
    ? configured
    : ["primary", "openrouter", "groq", "litellm", "openai-compatible"];
}

function getFreeAiCandidates(params: {
  selectedModel: AccessibleModel;
  requiresVision: boolean;
}) {
  const { selectedModel, requiresVision } = params;
  const candidates: Candidate[] = [];
  const order = getFreeProviderOrder();
  const allowVisionFallback = isEnabled(process.env.FREE_AI_ENABLE_VISION_FALLBACK);

  for (const source of order) {
    const normalized = source.toLowerCase().trim();

    if (normalized === "primary") {
      candidates.push(createPrimaryCandidate(selectedModel));
      continue;
    }

    if (normalized === "openrouter") {
      if (!process.env.OPENROUTER_API_KEY) continue;
      if (requiresVision && !allowVisionFallback) continue;

      const models = splitEnvList(process.env.OPENROUTER_FREE_MODELS);
      const modelList = models.length > 0 ? models : ["openrouter/free"];

      for (const model of modelList) {
        candidates.push({
          source: "openrouter",
          provider: "openrouter",
          model,
          label: `openrouter:${model}`,
          languageModel: getOpenRouterModel(model),
        });
      }

      continue;
    }

    if (normalized === "groq") {
      if (!process.env.GROQ_API_KEY) continue;
      if (requiresVision) continue;

      const models = splitEnvList(process.env.GROQ_FREE_MODELS);

      for (const model of models) {
        candidates.push({
          source: "groq",
          provider: "groq",
          model,
          label: `groq:${model}`,
          languageModel: getGroqModel(model),
        });
      }

      continue;
    }

    if (normalized === "litellm") {
      if (!process.env.LITELLM_BASE_URL || !process.env.LITELLM_API_KEY) {
        continue;
      }
      if (requiresVision && !allowVisionFallback) continue;

      const models = splitEnvList(process.env.FREE_LITELLM_MODELS);

      for (const model of models) {
        candidates.push({
          source: "litellm",
          provider: "litellm",
          model,
          label: `litellm:${model}`,
          languageModel: getLiteLLMModel(model),
        });
      }

      continue;
    }

    if (normalized === "openai-compatible" || normalized === "compatible") {
      if (
        !process.env.OPENAI_COMPATIBLE_BASE_URL ||
        !process.env.OPENAI_COMPATIBLE_API_KEY
      ) {
        continue;
      }
      if (requiresVision && !allowVisionFallback) continue;

      const models = splitEnvList(process.env.OPENAI_COMPATIBLE_FREE_MODELS);

      for (const model of models) {
        candidates.push({
          source: "openai-compatible",
          provider: "openai-compatible",
          model,
          label: `openai-compatible:${model}`,
          languageModel: getOpenAICompatibleModel(model),
        });
      }
    }
  }

  if (candidates.length === 0) {
    candidates.push(createPrimaryCandidate(selectedModel));
  }

  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = `${candidate.provider}:${candidate.model}`;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function getCandidates(params: {
  selectedModel: AccessibleModel;
  requiresVision: boolean;
}) {
  if (!params.selectedModel.isFree) {
    return [createPrimaryCandidate(params.selectedModel)];
  }

  return getFreeAiCandidates(params);
}

function toSafeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 300);
  }

  return "Unknown error";
}

function buildAllCandidatesFailedError(errors: string[]) {
  const message =
    "Các nguồn AI miễn phí đang bận hoặc đã quá giới hạn. Vui lòng thử lại sau ít phút.";

  const error = new Error(message);
  error.name = "FreeAiRouterError";

  if (errors.length > 0) {
    console.warn("FREE_AI_ROUTER_ALL_FAILED:", errors.join(" | "));
  }

  return error;
}

export async function generateTextWithAiRouter(
  params: RouterParams,
): Promise<AiRouterResult> {
  const candidates = getCandidates({
    selectedModel: params.selectedModel,
    requiresVision: Boolean(params.requiresVision),
  });
  const errors: string[] = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];

    try {
      const result = await generateText({
        model: candidate.languageModel,
        maxOutputTokens: params.maxOutputTokens,
        messages: params.messages,
      });

      return {
        text: result.text,
        provider: candidate.provider,
        model: candidate.model,
        source: candidate.source,
        fallbackUsed: index > 0,
        usage: result.usage,
      };
    } catch (error) {
      errors.push(`${candidate.label}: ${toSafeErrorMessage(error)}`);
    }
  }

  throw buildAllCandidatesFailedError(errors);
}

export async function* streamTextWithAiRouter(
  params: RouterParams,
): AsyncGenerator<AiRouterStreamEvent> {
  const candidates = getCandidates({
    selectedModel: params.selectedModel,
    requiresVision: Boolean(params.requiresVision),
  });
  const errors: string[] = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    let fullText = "";
    let didSendAnyDelta = false;

    try {
      const result = streamText({
        model: candidate.languageModel,
        maxOutputTokens: params.maxOutputTokens,
        messages: params.messages,
      });

      for await (const textDelta of result.textStream) {
        didSendAnyDelta = true;
        fullText += textDelta;

        yield {
          type: "delta",
          textDelta,
        };
      }

      yield {
        type: "finish",
        text: fullText,
        provider: candidate.provider,
        model: candidate.model,
        source: candidate.source,
        fallbackUsed: index > 0,
      };

      return;
    } catch (error) {
      if (didSendAnyDelta) {
        throw error;
      }

      errors.push(`${candidate.label}: ${toSafeErrorMessage(error)}`);
    }
  }

  throw buildAllCandidatesFailedError(errors);
}

export function getFreeAiRouterStatus() {
  const order = getFreeProviderOrder();

  return {
    order,
    openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    openRouterModels: splitEnvList(process.env.OPENROUTER_FREE_MODELS).length
      ? splitEnvList(process.env.OPENROUTER_FREE_MODELS)
      : ["openrouter/free"],
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    groqModels: splitEnvList(process.env.GROQ_FREE_MODELS),
    liteLLMConfigured: Boolean(
      process.env.LITELLM_BASE_URL && process.env.LITELLM_API_KEY,
    ),
    liteLLMModels: splitEnvList(process.env.FREE_LITELLM_MODELS),
    openAICompatibleConfigured: Boolean(
      process.env.OPENAI_COMPATIBLE_BASE_URL &&
        process.env.OPENAI_COMPATIBLE_API_KEY,
    ),
    openAICompatibleModels: splitEnvList(
      process.env.OPENAI_COMPATIBLE_FREE_MODELS,
    ),
    visionFallbackEnabled: isEnabled(process.env.FREE_AI_ENABLE_VISION_FALLBACK),
  };
}
