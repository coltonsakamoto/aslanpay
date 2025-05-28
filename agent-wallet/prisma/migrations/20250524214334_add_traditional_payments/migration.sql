/*
  Warnings:

  - Added the required column `type` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "CreditCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "stripeId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreditCard_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "routingNumber" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "stripeId" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BankAccount_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Agent_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Agent" ("createdAt", "id", "lastResetAt", "limitSat", "spentTodaySat", "token", "updatedAt", "walletId") SELECT "createdAt", "id", "lastResetAt", "limitSat", "spentTodaySat", "token", "updatedAt", "walletId" FROM "Agent";
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("agentId", "amountSat", "createdAt", "failureReason", "id", "invoice", "status", "updatedAt", "walletId") SELECT "agentId", "amountSat", "createdAt", "failureReason", "id", "invoice", "status", "updatedAt", "walletId" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE TABLE "new_Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "balanceSat" INTEGER NOT NULL DEFAULT 0,
    "balanceUSD" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Wallet" ("balanceSat", "createdAt", "id", "updatedAt") SELECT "balanceSat", "createdAt", "id", "updatedAt" FROM "Wallet";
DROP TABLE "Wallet";
ALTER TABLE "new_Wallet" RENAME TO "Wallet";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CreditCard_stripeId_key" ON "CreditCard"("stripeId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_stripeId_key" ON "BankAccount"("stripeId");
