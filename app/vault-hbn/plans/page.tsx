import { createPlan, togglePlanStatus, updatePlan, updatePlanModels } from "@/app/vault-hbn/actions";
import { prisma } from "@/lib/prisma";

function formatMoney(value: number | null | undefined) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

export default async function AdminPlansPage() {
  const [plans, models] = await Promise.all([
    prisma.plan.findMany({
      orderBy: [{ isActive: "desc" }, { price: "asc" }],
      include: {
        _count: {
          select: {
            orders: true,
            subscriptions: true,
          },
        },
        planModels: {
          include: {
            model: true,
          },
        },
      },
    }),
    prisma.modelConfig.findMany({
      orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gói dịch vụ</h1>
        <p className="mt-2 text-white/60">
          Tạo/sửa gói, bật tắt gói bán và gán model được mở sau khi user thanh toán.
        </p>
      </div>

      <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
        <h2 className="text-lg font-semibold">Tạo gói mới</h2>
        <form action={createPlan} className="mt-4 grid gap-3 md:grid-cols-5">
          <input
            name="name"
            placeholder="Tên gói"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
          />
          <input
            name="price"
            type="number"
            min="0"
            placeholder="Giá"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
          />
          <input
            name="durationDays"
            type="number"
            min="1"
            placeholder="Số ngày"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
          />
          <input
            name="messageLimitPerDay"
            type="number"
            min="1"
            placeholder="Lượt/ngày"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
          />
          <button className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400">
            Tạo gói
          </button>
        </form>
      </section>

      <div className="grid gap-5">
        {plans.map((plan) => {
          const selectedModelIds = new Set(plan.planModels.map((item) => item.modelId));

          return (
            <article key={plan.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${plan.isActive ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-red-400/30 bg-red-400/10 text-red-200"}`}>
                      {plan.isActive ? "Đang bán" : "Đã tắt"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/55">
                      {formatMoney(plan.price)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/55">
                      {plan.durationDays} ngày
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/55">
                      {plan.messageLimitPerDay} lượt/ngày
                    </span>
                  </div>

                  <h2 className="mt-3 text-xl font-semibold">{plan.name}</h2>
                  <p className="mt-1 text-sm text-white/50">
                    {plan._count.orders} đơn hàng · {plan._count.subscriptions} subscription · {plan.planModels.length} model được gán
                  </p>

                  <form action={updatePlan} className="mt-5 grid gap-3 md:grid-cols-5">
                    <input type="hidden" name="planId" value={plan.id} />
                    <div>
                      <label className="text-xs uppercase text-white/35">Tên gói</label>
                      <input
                        name="name"
                        defaultValue={plan.name}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase text-white/35">Giá</label>
                      <input
                        name="price"
                        type="number"
                        min="0"
                        defaultValue={plan.price}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase text-white/35">Ngày</label>
                      <input
                        name="durationDays"
                        type="number"
                        min="1"
                        defaultValue={plan.durationDays}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase text-white/35">Lượt/ngày</label>
                      <input
                        name="messageLimitPerDay"
                        type="number"
                        min="1"
                        defaultValue={plan.messageLimitPerDay}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                      />
                    </div>
                    <div className="flex flex-col justify-end gap-2">
                      <label className="flex items-center gap-2 text-sm text-white/65">
                        <input name="isActive" type="checkbox" defaultChecked={plan.isActive} />
                        Đang bán
                      </label>
                      <button className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/85">
                        Lưu gói
                      </button>
                    </div>
                  </form>
                </div>

                <div className="w-full shrink-0 space-y-3 xl:w-96">
                  <form action={togglePlanStatus} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <input type="hidden" name="planId" value={plan.id} />
                    <input type="hidden" name="isActive" value={plan.isActive ? "false" : "true"} />
                    <button className={`w-full rounded-lg px-3 py-2 text-sm font-semibold ${plan.isActive ? "border border-red-400/40 text-red-100 hover:bg-red-400/10" : "bg-emerald-500 text-black hover:bg-emerald-400"}`}>
                      {plan.isActive ? "Tắt bán gói" : "Bật bán gói"}
                    </button>
                  </form>

                  <form action={updatePlanModels} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <input type="hidden" name="planId" value={plan.id} />
                    <p className="text-sm font-medium">Model mở cho gói này</p>
                    <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                      {models.map((model) => (
                        <label key={model.id} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm">
                          <input
                            name="modelIds"
                            type="checkbox"
                            value={model.id}
                            defaultChecked={selectedModelIds.has(model.id)}
                            className="mt-1"
                          />
                          <span>
                            <span className="block font-medium">{model.displayName}</span>
                            <span className="mt-1 block text-xs text-white/40">
                              {model.provider}/{model.model} · {model.isFree ? "FREE" : model.category} · {model.isActive ? "active" : "off"}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <button className="mt-3 w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black hover:bg-emerald-400">
                      Lưu model cho gói
                    </button>
                  </form>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
