-- CreateTable
CREATE TABLE "PlanModel" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,

    CONSTRAINT "PlanModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserModelAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ORDER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserModelAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanModel_planId_modelId_key" ON "PlanModel"("planId", "modelId");

-- CreateIndex
CREATE UNIQUE INDEX "UserModelAccess_userId_modelId_key" ON "UserModelAccess"("userId", "modelId");

-- AddForeignKey
ALTER TABLE "PlanModel" ADD CONSTRAINT "PlanModel_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanModel" ADD CONSTRAINT "PlanModel_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserModelAccess" ADD CONSTRAINT "UserModelAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserModelAccess" ADD CONSTRAINT "UserModelAccess_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
