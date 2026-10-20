-- Supporting indexes for review queues, genre aggregation, recent activity, and timelines.
CREATE INDEX "media_items_review_status_is_active_created_at_idx"
ON "media_items"("review_status", "is_active", "created_at" DESC);

CREATE INDEX "media_genres_genre_id_media_item_id_idx"
ON "media_genres"("genre_id", "media_item_id");

CREATE INDEX "library_entries_user_id_updated_at_idx"
ON "library_entries"("user_id", "updated_at" DESC);

CREATE INDEX "progress_events_recorded_at_idx"
ON "progress_events"("recorded_at" DESC);

-- Current user/library state joined with canonical media metadata.
CREATE VIEW "user_library_summary" AS
SELECT
    le."id" AS "library_entry_id",
    le."user_id",
    le."media_item_id",
    mi."title",
    mt."code" AS "media_type_code",
    mt."section",
    mt."progress_mode",
    le."status",
    le."progress_value",
    mi."total_units",
    CASE
        WHEN mt."progress_mode" = 'PERCENTAGE' THEN LEAST(le."progress_value", 100)
        WHEN mi."total_units" IS NOT NULL AND mi."total_units" > 0
            THEN ROUND((le."progress_value" / mi."total_units") * 100, 2)
        ELSE NULL
    END AS "progress_percentage",
    le."rating",
    le."current_unit_id",
    le."started_at",
    le."completed_at",
    le."updated_at"
FROM "library_entries" le
JOIN "media_items" mi ON mi."id" = le."media_item_id"
JOIN "media_types" mt ON mt."id" = mi."media_type_id";

-- Reusable popularity totals for catalogue and recommendation queries.
CREATE VIEW "media_popularity_summary" AS
SELECT
    mi."id" AS "media_item_id",
    mi."title",
    mt."code" AS "media_type_code",
    COUNT(le."id")::BIGINT AS "library_count",
    COUNT(le."id") FILTER (WHERE le."status" = 'COMPLETED')::BIGINT AS "completed_count",
    ROUND(AVG(le."rating"), 2) AS "average_rating",
    MAX(le."updated_at") AS "last_library_activity"
FROM "media_items" mi
JOIN "media_types" mt ON mt."id" = mi."media_type_id"
LEFT JOIN "library_entries" le ON le."media_item_id" = mi."id"
WHERE mi."is_active" = TRUE
GROUP BY mi."id", mi."title", mt."code";

-- Aggregate one user's genre preferences for explainable recommendations.
CREATE FUNCTION "get_user_genre_profile"(requested_user_id UUID)
RETURNS TABLE (
    "genre_id" SMALLINT,
    "genre_name" VARCHAR(100),
    "title_count" BIGINT,
    "completed_count" BIGINT,
    "average_rating" NUMERIC,
    "preference_score" NUMERIC
)
LANGUAGE SQL
STABLE
AS $$
    SELECT
        g."id" AS "genre_id",
        g."name" AS "genre_name",
        COUNT(DISTINCT le."media_item_id")::BIGINT AS "title_count",
        COUNT(DISTINCT le."media_item_id")
            FILTER (WHERE le."status" = 'COMPLETED')::BIGINT AS "completed_count",
        ROUND(AVG(le."rating"), 2) AS "average_rating",
        ROUND((
            COUNT(DISTINCT le."media_item_id")
            + COUNT(DISTINCT le."media_item_id")
                FILTER (WHERE le."status" = 'COMPLETED') * 1.5
            + COALESCE(AVG(le."rating"), 0) / 10
        )::NUMERIC, 3) AS "preference_score"
    FROM "library_entries" le
    JOIN "media_genres" mg ON mg."media_item_id" = le."media_item_id"
    JOIN "genres" g ON g."id" = mg."genre_id"
    WHERE le."user_id" = requested_user_id
    GROUP BY g."id", g."name"
    ORDER BY "preference_score" DESC, g."name" ASC;
$$;

-- Automatically retain old/new values whenever personal library state changes.
CREATE FUNCTION "audit_library_entry_update"()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
    INSERT INTO "audit_logs" (
        "actor_user_id",
        "action",
        "entity_type",
        "entity_id",
        "old_values",
        "new_values"
    ) VALUES (
        NEW."user_id",
        'LIBRARY_ENTRY_UPDATED',
        'library_entry',
        NEW."id"::TEXT,
        TO_JSONB(OLD),
        TO_JSONB(NEW)
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER "library_entry_update_audit_trigger"
AFTER UPDATE ON "library_entries"
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION "audit_library_entry_update"();
