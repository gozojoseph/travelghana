-- D35: lifecycle emails carry a 6-digit code alongside the deep-linked token.
-- Both codes are stored hashed (sha256) on the same record as their link twin,
-- so a verification or reset has one single source that can be consumed via
-- either mechanism. Nullable: rows created before this migration keep working.
ALTER TABLE "EmailVerificationToken" ADD COLUMN "codeHash" TEXT;
ALTER TABLE "PasswordResetToken" ADD COLUMN "codeHash" TEXT;
