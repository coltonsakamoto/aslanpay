-- CreateTable
CREATE TABLE "PurchaseApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "service" TEXT NOT NULL,
    "params" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "userResponse" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseApproval_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "limitSat" INTEGER NOT NULL,
    "limitUSD" INTEGER NOT NULL DEFAULT 0,
    "spentTodaySat" INTEGER NOT NULL DEFAULT 0,
    "spentTodayUSD" INTEGER NOT NULL DEFAULT 0,
    "spentThisMonth" INTEGER NOT NULL DEFAULT 0,
    "monthlyLimitUSD" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "lastResetAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMode" TEXT NOT NULL DEFAULT 'wallet',
    "dailyLimitUSD" INTEGER NOT NULL DEFAULT 5000,
    "transactionLimitUSD" INTEGER NOT NULL DEFAULT 50000,
    "categoryLimits" TEXT,
    "approvalSettings" TEXT,
    "emergencyStop" BOOLEAN NOT NULL DEFAULT false,
    "velocityLimit" INTEGER NOT NULL DEFAULT 10,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Agent_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Agent" ("category", "createdAt", "id", "lastResetAt", "limitSat", "limitUSD", "monthlyLimitUSD", "spentThisMonth", "spentTodaySat", "spentTodayUSD", "token", "updatedAt", "walletId") SELECT "category", "createdAt", "id", "lastResetAt", "limitSat", "limitUSD", "monthlyLimitUSD", "spentThisMonth", "spentTodaySat", "spentTodayUSD", "token", "updatedAt", "walletId" FROM "Agent";
DROP TABLE "Agent";
ALTER TABLE "new_Agent" RENAME TO "Agent";
CREATE UNIQUE INDEX "Agent_token_key" ON "Agent"("token");
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "agentId" TEXT,
    "invoice" TEXT,
    "amountSat" INTEGER NOT NULL DEFAULT 0,
    "amountUSD" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "failureReason" TEXT,
    "stripeId" TEXT,
    "metadata" TEXT,
    "service" TEXT,
    "paymentMode" TEXT NOT NULL DEFAULT 'wallet',
    "cardLast4" TEXT,
    "approvalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("agentId", "amountSat", "amountUSD", "createdAt", "failureReason", "id", "invoice", "metadata", "status", "stripeId", "type", "updatedAt", "walletId") SELECT "agentId", "amountSat", "amountUSD", "createdAt", "failureReason", "id", "invoice", "metadata", "status", "stripeId", "type", "updatedAt", "walletId" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
