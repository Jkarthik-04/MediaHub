-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "media_section" AS ENUM ('READING', 'WATCHING');

-- CreateEnum
CREATE TYPE "progress_mode" AS ENUM ('PERCENTAGE', 'PAGE', 'CHAPTER', 'EPISODE');

-- CreateEnum
CREATE TYPE "metadata_origin" AS ENUM ('EXTERNAL', 'MANUAL');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('APPROVED', 'PENDING_REVIEW', 'REJECTED');

-- CreateEnum
CREATE TYPE "unit_kind" AS ENUM ('SEASON', 'EPISODE', 'VOLUME', 'CHAPTER', 'EDITION');

-- CreateEnum
CREATE TYPE "library_status" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'DROPPED');

-- CreateEnum
CREATE TYPE "connector_kind" AS ENUM ('API', 'EXPORT', 'SCRAPER');

-- CreateEnum
CREATE TYPE "ingestion_kind" AS ENUM ('SELECTED_RESULTS', 'PUBLIC_LIST_URL', 'FILE_UPLOAD');

-- CreateEnum
CREATE TYPE "ingestion_status" AS ENUM ('QUEUED', 'RUNNING', 'PREVIEW_READY', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "import_action" AS ENUM ('CREATE', 'REUSE', 'REVIEW_MATCH', 'SKIP');

-- CreateEnum
CREATE TYPE "import_decision" AS ENUM ('UNDECIDED', 'CREATE', 'REUSE', 'SKIP');

-- CreateEnum
CREATE TYPE "recommendation_feedback" AS ENUM ('NONE', 'USEFUL', 'NOT_INTERESTED', 'DISMISSED');

-- CreateTable
CREATE TABLE "roles" (
    "id" SMALLSERIAL NOT NULL,
    "name" VARCHAR(30) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_id" SMALLINT NOT NULL,
    "google_subject" VARCHAR(255) NOT NULL,
    "email" CITEXT NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "avatar_url" TEXT,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_types" (
    "id" SMALLSERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "section" "media_section" NOT NULL,
    "progress_mode" "progress_mode" NOT NULL,

    CONSTRAINT "media_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "media_type_id" SMALLINT NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "normalized_title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "release_date" DATE,
    "cover_url" TEXT,
    "total_units" INTEGER,
    "origin" "metadata_origin" NOT NULL,
    "review_status" "review_status" NOT NULL,
    "created_by_user_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genres" (
    "id" SMALLSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_genres" (
    "media_item_id" UUID NOT NULL,
    "genre_id" SMALLINT NOT NULL,

    CONSTRAINT "media_genres_pkey" PRIMARY KEY ("media_item_id","genre_id")
);

-- CreateTable
CREATE TABLE "media_units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "media_item_id" UUID NOT NULL,
    "parent_unit_id" UUID,
    "unit_kind" "unit_kind" NOT NULL,
    "sequence_number" DECIMAL(8,2) NOT NULL,
    "season_number" INTEGER,
    "title" VARCHAR(300),
    "duration_minutes" INTEGER,
    "page_count" INTEGER,
    "release_date" DATE,

    CONSTRAINT "media_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "media_item_id" UUID NOT NULL,
    "status" "library_status" NOT NULL DEFAULT 'PLANNED',
    "progress_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "current_unit_id" UUID,
    "rating" DECIMAL(3,1),
    "notes" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "library_entry_id" UUID NOT NULL,
    "unit_id" UUID,
    "old_progress" DECIMAL(10,2),
    "new_progress" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" SMALLSERIAL NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "connector_kind" "connector_kind" NOT NULL,
    "base_url" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "terms_checked_at" DATE NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_mappings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "media_item_id" UUID NOT NULL,
    "source_id" SMALLINT NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "source_url" TEXT NOT NULL,
    "content_hash" VARCHAR(128),
    "last_synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "requested_by_user_id" UUID NOT NULL,
    "source_id" SMALLINT,
    "kind" "ingestion_kind" NOT NULL,
    "status" "ingestion_status" NOT NULL DEFAULT 'QUEUED',
    "input_reference" VARCHAR(500),
    "candidate_count" INTEGER NOT NULL DEFAULT 0,
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "error_code" VARCHAR(80),
    "error_message" TEXT,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "ingestion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_candidates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "source_id" SMALLINT NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "media_type_id" SMALLINT NOT NULL,
    "normalized_payload" JSONB NOT NULL,
    "match_media_id" UUID,
    "match_confidence" DECIMAL(4,3),
    "proposed_action" "import_action" NOT NULL,
    "decision" "import_decision" NOT NULL DEFAULT 'UNDECIDED',
    "validation_errors" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingestion_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "media_item_id" UUID NOT NULL,
    "score" DECIMAL(6,5) NOT NULL,
    "model_version" VARCHAR(80) NOT NULL,
    "reason" TEXT NOT NULL,
    "feedback" "recommendation_feedback" NOT NULL DEFAULT 'NONE',
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" VARCHAR(255) NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "request_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraints
-- Prisma does not currently model PostgreSQL CHECK constraints, so the
-- reviewed Phase 3 integrity rules are maintained explicitly in SQL.
ALTER TABLE "media_items"
    ADD CONSTRAINT "media_items_total_units_check"
    CHECK ("total_units" IS NULL OR "total_units" >= 0);

ALTER TABLE "media_units"
    ADD CONSTRAINT "media_units_sequence_number_check" CHECK ("sequence_number" >= 0),
    ADD CONSTRAINT "media_units_season_number_check" CHECK ("season_number" IS NULL OR "season_number" >= 0),
    ADD CONSTRAINT "media_units_duration_minutes_check" CHECK ("duration_minutes" IS NULL OR "duration_minutes" > 0),
    ADD CONSTRAINT "media_units_page_count_check" CHECK ("page_count" IS NULL OR "page_count" > 0);

ALTER TABLE "library_entries"
    ADD CONSTRAINT "library_entries_progress_value_check" CHECK ("progress_value" >= 0),
    ADD CONSTRAINT "library_entries_rating_check" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 10);

ALTER TABLE "progress_events"
    ADD CONSTRAINT "progress_events_old_progress_check" CHECK ("old_progress" IS NULL OR "old_progress" >= 0),
    ADD CONSTRAINT "progress_events_new_progress_check" CHECK ("new_progress" >= 0);

ALTER TABLE "ingestion_jobs"
    ADD CONSTRAINT "ingestion_jobs_candidate_count_check" CHECK ("candidate_count" >= 0),
    ADD CONSTRAINT "ingestion_jobs_imported_count_check" CHECK ("imported_count" >= 0),
    ADD CONSTRAINT "ingestion_jobs_skipped_count_check" CHECK ("skipped_count" >= 0),
    ADD CONSTRAINT "ingestion_jobs_failed_count_check" CHECK ("failed_count" >= 0);

ALTER TABLE "ingestion_candidates"
    ADD CONSTRAINT "ingestion_candidates_match_confidence_check"
    CHECK ("match_confidence" IS NULL OR "match_confidence" BETWEEN 0 AND 1);

ALTER TABLE "recommendations"
    ADD CONSTRAINT "recommendations_score_check" CHECK ("score" BETWEEN 0 AND 1);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_subject_key" ON "users"("google_subject");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "media_types_code_key" ON "media_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "media_types_name_key" ON "media_types"("name");

-- CreateIndex
CREATE INDEX "media_items_media_type_id_normalized_title_idx" ON "media_items"("media_type_id", "normalized_title");

-- CreateIndex
CREATE UNIQUE INDEX "genres_name_key" ON "genres"("name");

-- CreateIndex
CREATE UNIQUE INDEX "genres_slug_key" ON "genres"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "media_units_media_item_id_unit_kind_sequence_number_key" ON "media_units"("media_item_id", "unit_kind", "sequence_number");

-- CreateIndex
CREATE INDEX "library_entries_user_id_status_updated_at_idx" ON "library_entries"("user_id", "status", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "library_entries_user_id_media_item_id_key" ON "library_entries"("user_id", "media_item_id");

-- CreateIndex
CREATE INDEX "progress_events_library_entry_id_recorded_at_idx" ON "progress_events"("library_entry_id", "recorded_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "sources_key_key" ON "sources"("key");

-- CreateIndex
CREATE UNIQUE INDEX "sources_name_key" ON "sources"("name");

-- CreateIndex
CREATE INDEX "external_mappings_media_item_id_idx" ON "external_mappings"("media_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_mappings_source_id_external_id_key" ON "external_mappings"("source_id", "external_id");

-- CreateIndex
CREATE INDEX "ingestion_jobs_requested_by_user_id_status_requested_at_idx" ON "ingestion_jobs"("requested_by_user_id", "status", "requested_at" DESC);

-- CreateIndex
CREATE INDEX "ingestion_jobs_status_requested_at_idx" ON "ingestion_jobs"("status", "requested_at");

-- CreateIndex
CREATE INDEX "ingestion_candidates_job_id_decision_idx" ON "ingestion_candidates"("job_id", "decision");

-- CreateIndex
CREATE INDEX "ingestion_candidates_match_media_id_idx" ON "ingestion_candidates"("match_media_id");

-- CreateIndex
CREATE UNIQUE INDEX "ingestion_candidates_job_id_source_id_external_id_key" ON "ingestion_candidates"("job_id", "source_id", "external_id");

-- CreateIndex
CREATE INDEX "recommendations_user_id_score_idx" ON "recommendations"("user_id", "score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "recommendations_user_id_media_item_id_model_version_generat_key" ON "recommendations"("user_id", "media_item_id", "model_version", "generated_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_media_type_id_fkey" FOREIGN KEY ("media_type_id") REFERENCES "media_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_genres" ADD CONSTRAINT "media_genres_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "media_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_genres" ADD CONSTRAINT "media_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_units" ADD CONSTRAINT "media_units_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "media_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_units" ADD CONSTRAINT "media_units_parent_unit_id_fkey" FOREIGN KEY ("parent_unit_id") REFERENCES "media_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "media_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_current_unit_id_fkey" FOREIGN KEY ("current_unit_id") REFERENCES "media_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_library_entry_id_fkey" FOREIGN KEY ("library_entry_id") REFERENCES "library_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "media_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_mappings" ADD CONSTRAINT "external_mappings_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "media_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_mappings" ADD CONSTRAINT "external_mappings_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_candidates" ADD CONSTRAINT "ingestion_candidates_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "ingestion_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_candidates" ADD CONSTRAINT "ingestion_candidates_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_candidates" ADD CONSTRAINT "ingestion_candidates_media_type_id_fkey" FOREIGN KEY ("media_type_id") REFERENCES "media_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_candidates" ADD CONSTRAINT "ingestion_candidates_match_media_id_fkey" FOREIGN KEY ("match_media_id") REFERENCES "media_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "media_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
