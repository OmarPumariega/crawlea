-- Visibilidad en IA: preguntas seguidas y su histórico de comprobaciones
CREATE TABLE "AiPrompt" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiPrompt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiCheck" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "model" TEXT,
    "cited" BOOLEAN NOT NULL,
    "mentioned" BOOLEAN NOT NULL,
    "citedRank" INTEGER,
    "sources" JSONB NOT NULL,
    "answer" TEXT NOT NULL,
    "costUsd" DECIMAL(10,6),
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiPrompt_projectId_idx" ON "AiPrompt"("projectId");
CREATE UNIQUE INDEX "AiPrompt_projectId_prompt_key" ON "AiPrompt"("projectId", "prompt");
CREATE INDEX "AiCheck_promptId_checkedAt_idx" ON "AiCheck"("promptId", "checkedAt");

ALTER TABLE "AiPrompt" ADD CONSTRAINT "AiPrompt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCheck" ADD CONSTRAINT "AiCheck_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "AiPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
