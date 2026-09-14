-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CheckInQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'DAILY',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "overridesId" TEXT,
    CONSTRAINT "CheckInQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CheckInQuestion_overridesId_fkey" FOREIGN KEY ("overridesId") REFERENCES "CheckInQuestion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CheckInQuestion" ("active", "category", "id", "order", "text") SELECT "active", "category", "id", "order", "text" FROM "CheckInQuestion";
DROP TABLE "CheckInQuestion";
ALTER TABLE "new_CheckInQuestion" RENAME TO "CheckInQuestion";
CREATE INDEX "CheckInQuestion_userId_idx" ON "CheckInQuestion"("userId");
CREATE UNIQUE INDEX "CheckInQuestion_userId_overridesId_key" ON "CheckInQuestion"("userId", "overridesId");
CREATE TABLE "new_CheckInSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "time" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "overridesId" TEXT,
    CONSTRAINT "CheckInSlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CheckInSlot_overridesId_fkey" FOREIGN KEY ("overridesId") REFERENCES "CheckInSlot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CheckInSlot" ("active", "createdAt", "id", "label", "time") SELECT "active", "createdAt", "id", "label", "time" FROM "CheckInSlot";
DROP TABLE "CheckInSlot";
ALTER TABLE "new_CheckInSlot" RENAME TO "CheckInSlot";
CREATE INDEX "CheckInSlot_userId_idx" ON "CheckInSlot"("userId");
CREATE UNIQUE INDEX "CheckInSlot_userId_overridesId_key" ON "CheckInSlot"("userId", "overridesId");
CREATE TABLE "new_TaskCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "overridesId" TEXT,
    CONSTRAINT "TaskCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskCategory_overridesId_fkey" FOREIGN KEY ("overridesId") REFERENCES "TaskCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TaskCategory" ("active", "createdAt", "id", "name") SELECT "active", "createdAt", "id", "name" FROM "TaskCategory";
DROP TABLE "TaskCategory";
ALTER TABLE "new_TaskCategory" RENAME TO "TaskCategory";
CREATE INDEX "TaskCategory_userId_idx" ON "TaskCategory"("userId");
CREATE UNIQUE INDEX "TaskCategory_userId_overridesId_key" ON "TaskCategory"("userId", "overridesId");
CREATE UNIQUE INDEX "TaskCategory_userId_name_key" ON "TaskCategory"("userId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
