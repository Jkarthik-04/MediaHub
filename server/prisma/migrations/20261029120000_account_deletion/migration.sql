CREATE TABLE "account_deletion_challenges" (
    "user_id" UUID NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "account_deletion_challenges_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "account_deletion_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "account_deletion_challenges_expires_at_idx" ON "account_deletion_challenges"("expires_at");
