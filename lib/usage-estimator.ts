export type UsageCostEstimate = {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  estimatedCostUsd: number;
  estimatedCostVnd: number;
};

const VND_PER_USD = 25_500;
const CHARS_PER_TOKEN = 4;

type ModelCostRule = {
  providerIncludes?: string;
  modelIncludes?: string;
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
};

const COST_RULES: ModelCostRule[] = [
  {
    providerIncludes: "openai",
    modelIncludes: "gpt-4",
    inputUsdPerMillionTokens: 5,
    outputUsdPerMillionTokens: 15,
  },
  {
    providerIncludes: "openai",
    modelIncludes: "gpt-3.5",
    inputUsdPerMillionTokens: 0.5,
    outputUsdPerMillionTokens: 1.5,
  },
  {
    providerIncludes: "google",
    modelIncludes: "gemini",
    inputUsdPerMillionTokens: 0.35,
    outputUsdPerMillionTokens: 1.05,
  },
];

function estimateTokensFromChars(charCount: number) {
  if (!Number.isFinite(charCount) || charCount <= 0) {
    return 0;
  }

  return Math.ceil(charCount / CHARS_PER_TOKEN);
}

function getCostRule(provider: string, model: string) {
  const normalizedProvider = provider.toLowerCase();
  const normalizedModel = model.toLowerCase();

  return (
    COST_RULES.find((rule) => {
      const providerMatch = rule.providerIncludes
        ? normalizedProvider.includes(rule.providerIncludes)
        : true;
      const modelMatch = rule.modelIncludes
        ? normalizedModel.includes(rule.modelIncludes)
        : true;

      return providerMatch && modelMatch;
    }) || {
      inputUsdPerMillionTokens: 1,
      outputUsdPerMillionTokens: 3,
    }
  );
}

export function estimateUsageCost({
  provider,
  model,
  inputTextLength,
  outputTextLength,
}: {
  provider: string;
  model: string;
  inputTextLength: number;
  outputTextLength: number;
}): UsageCostEstimate {
  const estimatedInputTokens = estimateTokensFromChars(inputTextLength);
  const estimatedOutputTokens = estimateTokensFromChars(outputTextLength);
  const costRule = getCostRule(provider, model);

  const estimatedCostUsd =
    (estimatedInputTokens / 1_000_000) * costRule.inputUsdPerMillionTokens +
    (estimatedOutputTokens / 1_000_000) * costRule.outputUsdPerMillionTokens;

  return {
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedTotalTokens: estimatedInputTokens + estimatedOutputTokens,
    estimatedCostUsd,
    estimatedCostVnd: Math.round(estimatedCostUsd * VND_PER_USD),
  };
}

export function sumUsageCost(
  logs: Array<{
    provider: string;
    model: string;
    inputTextLength: number;
    outputTextLength: number;
  }>,
) {
  return logs.reduce(
    (total, log) => {
      const estimate = estimateUsageCost(log);

      return {
        estimatedInputTokens:
          total.estimatedInputTokens + estimate.estimatedInputTokens,
        estimatedOutputTokens:
          total.estimatedOutputTokens + estimate.estimatedOutputTokens,
        estimatedTotalTokens:
          total.estimatedTotalTokens + estimate.estimatedTotalTokens,
        estimatedCostUsd: total.estimatedCostUsd + estimate.estimatedCostUsd,
        estimatedCostVnd: total.estimatedCostVnd + estimate.estimatedCostVnd,
      };
    },
    {
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
      estimatedTotalTokens: 0,
      estimatedCostUsd: 0,
      estimatedCostVnd: 0,
    },
  );
}
