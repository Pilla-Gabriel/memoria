/*
  Warnings:

  - Added the required column `baseId` to the `Alert` table without a default value. This is not possible if the table is not empty.
  - Added the required column `baseId` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `baseId` to the `CheckInSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `baseId` to the `Frente` table without a default value. This is not possible if the table is not empty.
  - Added the required column `baseId` to the `Goal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `baseId` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `baseId` to the `WeeklyReport` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Base" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "azureOrg" TEXT,
    "azureProject" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserBase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "baseId" TEXT NOT NULL,
    CONSTRAINT "UserBase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserBase_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Base" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "snoozedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baseId" TEXT NOT NULL,
    CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Alert_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Base" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Alert" ("createdAt", "id", "message", "read", "relatedId", "relatedType", "snoozedUntil", "type", "userId") SELECT "createdAt", "id", "message", "read", "relatedId", "relatedType", "snoozedUntil", "type", "userId" FROM "Alert";
DROP TABLE "Alert";
ALTER TABLE "new_Alert" RENAME TO "Alert";
CREATE INDEX "Alert_userId_read_idx" ON "Alert"("userId", "read");
CREATE INDEX "Alert_baseId_idx" ON "Alert"("baseId");
CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baseId" TEXT NOT NULL,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Base" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AuditLog" ("action", "createdAt", "entityId", "entityType", "field", "id", "newValue", "oldValue", "userId") SELECT "action", "createdAt", "entityId", "entityType", "field", "id", "newValue", "oldValue", "userId" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_baseId_idx" ON "AuditLog"("baseId");
CREATE TABLE "new_CheckInSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'DAILY',
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "slotId" TEXT,
    "baseId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" DATETIME,
    CONSTRAINT "CheckInSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CheckInSession_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "CheckInSlot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CheckInSession_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Base" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CheckInSession" ("answeredAt", "createdAt", "date", "id", "kind", "slotId", "status", "userId") SELECT "answeredAt", "createdAt", "date", "id", "kind", "slotId", "status", "userId" FROM "CheckInSession";
DROP TABLE "CheckInSession";
ALTER TABLE "new_CheckInSession" RENAME TO "CheckInSession";
CREATE INDEX "CheckInSession_userId_date_idx" ON "CheckInSession"("userId", "date");
CREATE INDEX "CheckInSession_baseId_idx" ON "CheckInSession"("baseId");
CREATE TABLE "new_Frente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "indicator" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "baselineValue" REAL NOT NULL,
    "currentValue" REAL NOT NULL,
    "targetValue" REAL NOT NULL,
    "targetDate" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'OUTRA',
    "sourceDetail" TEXT,
    "azureWorkItemTypes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerId" TEXT NOT NULL,
    "baseId" TEXT NOT NULL,
    CONSTRAINT "Frente_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Frente_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Base" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Frente" ("active", "azureWorkItemTypes", "baselineValue", "createdAt", "currentValue", "description", "id", "indicator", "name", "ownerId", "source", "sourceDetail", "targetDate", "targetValue", "unit", "updatedAt") SELECT "active", "azureWorkItemTypes", "baselineValue", "createdAt", "currentValue", "description", "id", "indicator", "name", "ownerId", "source", "sourceDetail", "targetDate", "targetValue", "unit", "updatedAt" FROM "Frente";
DROP TABLE "Frente";
ALTER TABLE "new_Frente" RENAME TO "Frente";
CREATE INDEX "Frente_active_idx" ON "Frente"("active");
CREATE INDEX "Frente_baseId_idx" ON "Frente"("baseId");
CREATE TABLE "new_Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "indicator" TEXT NOT NULL,
    "targetValue" REAL NOT NULL,
    "currentValue" REAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "unitType" TEXT NOT NULL DEFAULT 'NUMBER',
    "unitLabel" TEXT,
    "startDate" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "successCriteria" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerId" TEXT NOT NULL,
    "baseId" TEXT NOT NULL,
    CONSTRAINT "Goal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Goal_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Base" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Goal" ("createdAt", "currentValue", "description", "dueDate", "id", "indicator", "ownerId", "startDate", "status", "successCriteria", "targetValue", "title", "type", "unit", "unitLabel", "unitType", "updatedAt") SELECT "createdAt", "currentValue", "description", "dueDate", "id", "indicator", "ownerId", "startDate", "status", "successCriteria", "targetValue", "title", "type", "unit", "unitLabel", "unitType", "updatedAt" FROM "Goal";
DROP TABLE "Goal";
ALTER TABLE "new_Goal" RENAME TO "Goal";
CREATE INDEX "Goal_ownerId_status_idx" ON "Goal"("ownerId", "status");
CREATE INDEX "Goal_baseId_idx" ON "Goal"("baseId");
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "dueDate" DATETIME,
    "needsDueDate" BOOLEAN NOT NULL DEFAULT false,
    "origin" TEXT NOT NULL DEFAULT 'MANUAL',
    "category" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIA',
    "maxExtensions" INTEGER NOT NULL DEFAULT 2,
    "extensionsUsed" INTEGER NOT NULL DEFAULT 0,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "baseId" TEXT NOT NULL,
    CONSTRAINT "Task_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Base" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("category", "completedAt", "createdAt", "createdById", "description", "dueDate", "extensionsUsed", "id", "maxExtensions", "needsDueDate", "origin", "ownerId", "priority", "status", "title", "updatedAt") SELECT "category", "completedAt", "createdAt", "createdById", "description", "dueDate", "extensionsUsed", "id", "maxExtensions", "needsDueDate", "origin", "ownerId", "priority", "status", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_ownerId_status_idx" ON "Task"("ownerId", "status");
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");
CREATE INDEX "Task_baseId_idx" ON "Task"("baseId");
CREATE TABLE "new_WeeklyReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "hoje" TEXT,
    "semana" TEXT,
    "vitoria" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    "baseId" TEXT NOT NULL,
    CONSTRAINT "WeeklyReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WeeklyReport_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Base" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WeeklyReport" ("createdAt", "createdById", "hoje", "id", "kind", "publishedAt", "semana", "status", "vitoria", "weekStart") SELECT "createdAt", "createdById", "hoje", "id", "kind", "publishedAt", "semana", "status", "vitoria", "weekStart" FROM "WeeklyReport";
DROP TABLE "WeeklyReport";
ALTER TABLE "new_WeeklyReport" RENAME TO "WeeklyReport";
CREATE INDEX "WeeklyReport_createdById_weekStart_idx" ON "WeeklyReport"("createdById", "weekStart");
CREATE INDEX "WeeklyReport_baseId_idx" ON "WeeklyReport"("baseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Base_slug_key" ON "Base"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserBase_userId_baseId_key" ON "UserBase"("userId", "baseId");
