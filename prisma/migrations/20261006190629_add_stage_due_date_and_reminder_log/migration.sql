-- AlterTable
ALTER TABLE "CaseStage" ADD COLUMN     "dueDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StageReminderLog" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "daysBefore" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StageReminderLog_stageId_idx" ON "StageReminderLog"("stageId");

-- CreateIndex
CREATE UNIQUE INDEX "StageReminderLog_stageId_daysBefore_channel_key" ON "StageReminderLog"("stageId", "daysBefore", "channel");

-- CreateIndex
CREATE INDEX "CaseStage_dueDate_status_idx" ON "CaseStage"("dueDate", "status");

-- AddForeignKey
ALTER TABLE "StageReminderLog" ADD CONSTRAINT "StageReminderLog_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "CaseStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
