-- CreateEnum
CREATE TYPE "connection_status" AS ENUM ('CONNECTED', 'EXPIRED', 'REVOKED', 'ERROR');

-- CreateTable
CREATE TABLE "user_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "source_id" SMALLINT NOT NULL,
    "external_user_id" VARCHAR(255) NOT NULL,
    "external_username" VARCHAR(255),
    "access_token_encrypted" TEXT,
    "refresh_token_encrypted" TEXT,
    "token_expires_at" TIMESTAMPTZ(6),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "connection_status" NOT NULL DEFAULT 'CONNECTED',
    "sync_cursor" JSONB,
    "last_synced_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_connections_user_id_status_idx" ON "user_connections"("user_id", "status");

-- CreateIndex
CREATE INDEX "user_connections_source_id_status_idx" ON "user_connections"("source_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_connections_user_id_source_id_key" ON "user_connections"("user_id", "source_id");

-- AddForeignKey
ALTER TABLE "user_connections" ADD CONSTRAINT "user_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_connections" ADD CONSTRAINT "user_connections_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
