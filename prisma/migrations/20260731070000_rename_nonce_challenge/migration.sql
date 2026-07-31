-- RenameTable
ALTER TABLE "NonceChallenge" RENAME TO "Nonce";

-- Rename constraints/indexes to match the new table name
ALTER TABLE "Nonce" RENAME CONSTRAINT "NonceChallenge_pkey" TO "Nonce_pkey";
ALTER INDEX "NonceChallenge_nonce_key" RENAME TO "Nonce_nonce_key";
