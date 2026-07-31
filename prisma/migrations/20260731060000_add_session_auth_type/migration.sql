-- CreateEnum
CREATE TYPE "AuthType" AS ENUM ('WALLET', 'CREDENTIALS');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "authType" "AuthType" NOT NULL DEFAULT 'CREDENTIALS';
