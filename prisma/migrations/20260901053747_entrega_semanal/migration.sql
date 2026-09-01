-- CreateTable
CREATE TABLE "Frente" (
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
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Frente_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FrenteSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "frenteId" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FrenteSnapshot_frenteId_fkey" FOREIGN KEY ("frenteId") REFERENCES "Frente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FrenteSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "frenteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "taskId" TEXT,
    "deliveredById" TEXT NOT NULL,
    "deliveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Delivery_frenteId_fkey" FOREIGN KEY ("frenteId") REFERENCES "Frente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Delivery_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_deliveredById_fkey" FOREIGN KEY ("deliveredById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Blocker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "frenteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "ownerToUnblockId" TEXT,
    "ownerToUnblockName" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "Blocker_frenteId_fkey" FOREIGN KEY ("frenteId") REFERENCES "Frente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Blocker_ownerToUnblockId_fkey" FOREIGN KEY ("ownerToUnblockId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Blocker_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyReport" (
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
    CONSTRAINT "WeeklyReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Frente_active_idx" ON "Frente"("active");

-- CreateIndex
CREATE INDEX "FrenteSnapshot_frenteId_createdAt_idx" ON "FrenteSnapshot"("frenteId", "createdAt");

-- CreateIndex
CREATE INDEX "Delivery_frenteId_deliveredAt_idx" ON "Delivery"("frenteId", "deliveredAt");

-- CreateIndex
CREATE INDEX "Blocker_frenteId_status_idx" ON "Blocker"("frenteId", "status");

-- CreateIndex
CREATE INDEX "WeeklyReport_createdById_weekStart_idx" ON "WeeklyReport"("createdById", "weekStart");
