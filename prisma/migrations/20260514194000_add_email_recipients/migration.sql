-- Add monthly finance summary recipients.

CREATE TABLE IF NOT EXISTS "EmailRecipient" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailRecipient_userId_email_key" ON "EmailRecipient"("userId", "email");
CREATE INDEX IF NOT EXISTS "EmailRecipient_userId_isActive_idx" ON "EmailRecipient"("userId", "isActive");

ALTER TABLE "EmailRecipient"
  ADD CONSTRAINT "EmailRecipient_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
