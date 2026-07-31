-- DropIndex
DROP INDEX "Session_refreshToken_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "username" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "refreshToken",
ADD COLUMN     "ip" TEXT,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "refreshTokenHash" TEXT NOT NULL,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "userAgent" TEXT;

-- CreateTable
CREATE TABLE "NonceChallenge" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NonceChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NonceChallenge_nonce_key" ON "NonceChallenge"("nonce");

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");
