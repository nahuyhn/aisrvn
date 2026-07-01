import { getFreeAiRouterStatus } from "@/lib/ai-router";

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={
        enabled
          ? "rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200"
          : "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/45"
      }
    >
      {enabled ? "Đã cấu hình" : "Chưa cấu hình"}
    </span>
  );
}

function ProviderCard({
  title,
  enabled,
  models,
  note,
}: {
  title: string;
  enabled: boolean;
  models: string[];
  note: string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <StatusBadge enabled={enabled} />
      </div>

      <p className="mt-3 text-sm leading-6 text-white/60">{note}</p>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
        <p className="text-xs uppercase tracking-wide text-white/35">Model</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {models.length > 0 ? (
            models.map((model) => (
              <span
                key={model}
                className="rounded-lg bg-white/10 px-3 py-1 text-xs text-white/70"
              >
                {model}
              </span>
            ))
          ) : (
            <span className="text-sm text-white/35">Chưa đặt model</span>
          )}
        </div>
      </div>
    </section>
  );
}

export default function FreeAiAdminPage() {
  const status = getFreeAiRouterStatus();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-emerald-300">AI SITIKI Ops</p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          Free AI Router
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
          Trang này giúp kiểm tra cấu hình nguồn AI dành cho khách dùng thử và
          tài khoản free. Hệ thống chỉ hiển thị đã cấu hình hay chưa, không hiển
          thị API key.
        </p>
      </div>

      <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5">
        <h2 className="text-lg font-semibold text-emerald-100">
          Thứ tự gọi provider hiện tại
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {status.order.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="rounded-xl border border-emerald-300/20 bg-black/20 px-3 py-2 text-sm text-emerald-100"
            >
              {index + 1}. {item}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-emerald-50/70">
          Gợi ý vận hành: đặt <code>FREE_AI_PROVIDER_ORDER=openrouter,primary</code>
          để khách/free chạy OpenRouter trước, Gemini chỉ làm nguồn dự phòng.
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <ProviderCard
          title="OpenRouter"
          enabled={status.openRouterConfigured}
          models={status.openRouterModels}
          note="Nguồn nên dùng trước cho tài khoản free. Có thể dùng openrouter/free để tự chọn model miễn phí phù hợp."
        />

        <ProviderCard
          title="Groq"
          enabled={status.groqConfigured}
          models={status.groqModels}
          note="Nguồn phụ cho text-only, tốc độ nhanh. Chỉ hoạt động khi bạn đặt GROQ_FREE_MODELS."
        />

        <ProviderCard
          title="LiteLLM"
          enabled={status.liteLLMConfigured}
          models={status.liteLLMModels}
          note="Dành cho giai đoạn sau khi bạn có LiteLLM Proxy riêng. Không bắt buộc ở bước hiện tại."
        />

        <ProviderCard
          title="OpenAI-compatible custom"
          enabled={status.openAICompatibleConfigured}
          models={status.openAICompatibleModels}
          note="Dành cho provider khác có API tương thích OpenAI. Chỉ dùng khi bạn có base URL riêng."
        />
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-lg font-semibold text-white">Cấu hình vision fallback</h2>
        <p className="mt-3 text-sm leading-6 text-white/60">
          Vision fallback hiện đang: {" "}
          <span className="font-medium text-white">
            {status.visionFallbackEnabled ? "BẬT" : "TẮT"}
          </span>
          . Mặc định nên tắt để tránh provider text-only nhận request ảnh. Nếu
          muốn cho OpenRouter xử lý ảnh khi Gemini lỗi, đặt
          <code> FREE_AI_ENABLE_VISION_FALLBACK=true</code>.
        </p>
      </section>
    </div>
  );
}
