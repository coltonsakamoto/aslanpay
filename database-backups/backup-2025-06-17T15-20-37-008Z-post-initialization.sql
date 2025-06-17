PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'email',
    "googleId" TEXT,
    "githubId" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "subscriptionPlan" TEXT NOT NULL DEFAULT 'sandbox',
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'active',
    "stripeCustomerId" TEXT,
    "subscriptionTrialEnd" DATETIME
);
INSERT INTO users VALUES('user-123','test@aslanpay.com','Test User','hashed_password','email',NULL,NULL,1,'2025-06-16 20:01:39','2025-06-16 20:01:39','sandbox','active',NULL,NULL);
INSERT INTO users VALUES('3b6fd126-ccee-4d93-8081-8b0e70fc6b0e','test1750104180@aslanpay.com','Test User','$2b$12$kLY7cJ/5sbUfRBtoBcASUeJ/1ysPwyGu40V1W6w93ihqof1EsygUK','email',NULL,NULL,0,1750104181205,1750104181205,'sandbox','active',NULL,NULL);
INSERT INTO users VALUES('e61e6584-c7e1-4242-a378-b85ed1094254','coltonsak@gmail.com','Colton Sakamoto','$2b$12$7ZZsYahRtZQsm3FCAcGkmOEGjr7yn5UVNaZs7sYP/omWgUG287tzG','email',NULL,NULL,0,1750104610453,1750104610453,'sandbox','active',NULL,NULL);
CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "lastUsed" DATETIME,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" DATETIME,
    "permissions" TEXT NOT NULL DEFAULT 'authorize,confirm,refund',
    CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO api_keys VALUES('key-123','user-123','Test API Key','ak_live_7f8e9a1b2c3d4e5f6789abcdef012345678901234567890123','ak_live_','7f8e9a1b2c3d4e5f6789abcdef012345678901234567890123',1750104136934,2,'2025-06-16 20:01:39',0,1750104136939,'authorize,confirm,refund');
INSERT INTO api_keys VALUES('c568a6c0-3c7e-4947-89e1-bde9ba2408d9','user-123','Test API Key','ak_live_d8e00788157ab8749d9d89852d0693ba97677b9a34b2a3de816ff84695a504d8','ak_live_','d8e00788157ab8749d9d89852d0693ba97677b9a34b2a3de816ff84695a504d8',NULL,0,1750104136943,1,NULL,'authorize,confirm,refund');
INSERT INTO api_keys VALUES('bbca880a-5b16-429c-92eb-e74665ff3c81','3b6fd126-ccee-4d93-8081-8b0e70fc6b0e','Default Key','ak_live_c71d454645327e195067ee331ea0e0e8841d220c81c7ccc3e13d7547018e2dfd','ak_live_','c71d454645327e195067ee331ea0e0e8841d220c81c7ccc3e13d7547018e2dfd',1750104189603,2,1750104181207,0,1750104189606,'authorize,confirm,refund');
INSERT INTO api_keys VALUES('2940e816-9e85-494f-a37a-71858e8c91fc','3b6fd126-ccee-4d93-8081-8b0e70fc6b0e','Default Key','ak_live_8854df124a093a0e8b9324142d94f2a1d5246448c1defac22cd23535f65486a8','ak_live_','8854df124a093a0e8b9324142d94f2a1d5246448c1defac22cd23535f65486a8',NULL,0,1750104189609,1,NULL,'authorize,confirm,refund');
INSERT INTO api_keys VALUES('bd8f1e28-27ef-4787-9fbd-a276ad70ed5d','e61e6584-c7e1-4242-a378-b85ed1094254','Default Key','ak_live_28e2729f45d53a6def1367f3c1825b136d52bbc6ed92e185b52c06710ce9109e','ak_live_','28e2729f45d53a6def1367f3c1825b136d52bbc6ed92e185b52c06710ce9109e',NULL,0,1750104610457,1,NULL,'authorize,confirm,refund');
CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "lastActivity" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO sessions VALUES('bd8f8124-fc3a-40b8-8878-c30ffbe3dae3','3b6fd126-ccee-4d93-8081-8b0e70fc6b0e',1750104181209,1750708981208,1750104181209);
INSERT INTO sessions VALUES('3357dd8c-dcba-404f-994e-d346d71be525','e61e6584-c7e1-4242-a378-b85ed1094254',1750104610459,1750709410458,1750104610459);
INSERT INTO sessions VALUES('08d4270d-0b4d-4be8-b62d-283f53ba2872','e61e6584-c7e1-4242-a378-b85ed1094254',1750105230336,1750710030335,1750105230336);
INSERT INTO sessions VALUES('ef6bd400-2896-4452-b788-7a1597f6cf3e','e61e6584-c7e1-4242-a378-b85ed1094254',1750105248497,1750710048496,1750105248497);
INSERT INTO sessions VALUES('2ca51884-3bd1-446e-95b0-28af186b3036','e61e6584-c7e1-4242-a378-b85ed1094254',1750105330323,1750710130321,1750105330323);
CREATE TABLE IF NOT EXISTS "password_resets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "password_resets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "email_verifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "email_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "wallets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "balanceSat" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "agents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "limitSat" INTEGER NOT NULL,
    "spentTodaySat" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "agents_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "apiKeyId" TEXT,
    "agentId" TEXT,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "status" TEXT NOT NULL,
    "stripePaymentId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "apiKeyId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
CREATE UNIQUE INDEX "users_githubId_key" ON "users"("githubId");
CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON "users"("stripeCustomerId");
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");
CREATE UNIQUE INDEX "password_resets_token_key" ON "password_resets"("token");
CREATE UNIQUE INDEX "email_verifications_token_key" ON "email_verifications"("token");
COMMIT;
