# MediaHub Data Dictionary

**Schema version:** Planning v1  
**Conventions:** UUID primary keys use `gen_random_uuid()`; timestamps use `TIMESTAMPTZ`; text lengths are finalised in the Prisma migration review.

Abbreviations: **PK** primary key, **FK** foreign key, **UQ** unique, **NN** not null.

## `roles`

| Column | Type | Rules | Description/example |
|---|---|---|---|
| `id` | `SMALLSERIAL` | PK | Role identifier |
| `name` | `VARCHAR(30)` | NN, UQ | `USER`, `ADMIN` |

## `users`

| Column | Type | Rules | Description/example |
|---|---|---|---|
| `id` | `UUID` | PK | Internal user ID |
| `role_id` | `SMALLINT` | NN, FK `roles.id` | Permission role |
| `google_subject` | `VARCHAR(255)` | NN, UQ | Stable Google identity subject |
| `email` | `CITEXT` | NN, UQ | Case-insensitive login/contact email |
| `display_name` | `VARCHAR(120)` | NN | Display name |
| `avatar_url` | `TEXT` | Nullable | OAuth avatar URL |
| `status` | `USER_STATUS` | NN, default `ACTIVE` | `ACTIVE` or `SUSPENDED` |
| `created_at` | `TIMESTAMPTZ` | NN, default `now()` | Creation time |
| `updated_at` | `TIMESTAMPTZ` | NN, default `now()` | Last profile/security update |

## `media_types`

| Column | Type | Rules | Description/example |
|---|---|---|---|
| `id` | `SMALLSERIAL` | PK | Type ID |
| `code` | `VARCHAR(20)` | NN, UQ | `MOVIE`, `TV`, `ANIME`, `MANGA`, `BOOK` |
| `name` | `VARCHAR(50)` | NN, UQ | Display name |
| `section` | `MEDIA_SECTION` | NN | `READING` or `WATCHING` |
| `progress_mode` | `PROGRESS_MODE` | NN | Default progress interpretation |

## `media_items`

| Column | Type | Rules | Description/example |
|---|---|---|---|
| `id` | `UUID` | PK | Canonical MediaHub title ID |
| `media_type_id` | `SMALLINT` | NN, FK `media_types.id` | Category |
| `title` | `VARCHAR(300)` | NN | Preferred display title |
| `normalized_title` | `VARCHAR(300)` | NN | Lowercased/normalized matching form |
| `description` | `TEXT` | Nullable | Synopsis |
| `release_date` | `DATE` | Nullable | Exact/representative release date |
| `cover_url` | `TEXT` | Nullable | Approved provider image URL |
| `total_units` | `INTEGER` | Nullable, check `>= 0` | Runtime percentage basis, pages, chapters, or episodes as defined by type |
| `origin` | `METADATA_ORIGIN` | NN | `EXTERNAL` or `MANUAL` |
| `review_status` | `REVIEW_STATUS` | NN | Approval state; external validated records normally approved |
| `created_by_user_id` | `UUID` | Nullable, FK `users.id` | Submitter for manual records |
| `is_active` | `BOOLEAN` | NN, default `true` | Soft-delete/visibility flag |
| `created_at` | `TIMESTAMPTZ` | NN, default `now()` | Created time |
| `updated_at` | `TIMESTAMPTZ` | NN, default `now()` | Metadata update time |

## `genres`

| Column | Type | Rules | Description/example |
|---|---|---|---|
| `id` | `SMALLSERIAL` | PK | Genre ID |
| `name` | `VARCHAR(100)` | NN, UQ | `Science Fiction` |
| `slug` | `VARCHAR(100)` | NN, UQ | `science-fiction` |

## `media_genres`

| Column | Type | Rules | Description/example |
|---|---|---|---|
| `media_item_id` | `UUID` | PK, FK `media_items.id` | Media side of association |
| `genre_id` | `SMALLINT` | PK, FK `genres.id` | Genre side of association |

## `media_units`

| Column | Type | Rules | Description/example |
|---|---|---|---|
| `id` | `UUID` | PK | Unit ID |
| `media_item_id` | `UUID` | NN, FK `media_items.id` | Owning title |
| `parent_unit_id` | `UUID` | Nullable, self-FK | Episode parent season or chapter parent volume |
| `unit_kind` | `UNIT_KIND` | NN | Season/episode/volume/chapter/edition |
| `sequence_number` | `NUMERIC(8,2)` | NN, check `>= 0` | Allows chapters such as 12.5 |
| `season_number` | `INTEGER` | Nullable, check `>= 0` | Series season when applicable |
| `title` | `VARCHAR(300)` | Nullable | Unit title |
| `duration_minutes` | `INTEGER` | Nullable, check `> 0` | Episode/movie unit duration |
| `page_count` | `INTEGER` | Nullable, check `> 0` | Edition/chapter pages when known |
| `release_date` | `DATE` | Nullable | Unit release/publication date |

Unique key: `(media_item_id, unit_kind, sequence_number)` for v1; refine for season-scoped numbering during migration tests if providers reuse episode numbers per season.

## `library_entries`

| Column | Type | Rules | Description/example |
|---|---|---|---|
| `id` | `UUID` | PK | User-library entry ID |
| `user_id` | `UUID` | NN, FK `users.id` | Owner |
| `media_item_id` | `UUID` | NN, FK `media_items.id` | Canonical title |
| `status` | `LIBRARY_STATUS` | NN, default `PLANNED` | User state |
| `progress_value` | `NUMERIC(10,2)` | NN, default 0, check `>= 0` | Page/chapter/episode/percentage depending on type |
| `current_unit_id` | `UUID` | Nullable, FK `media_units.id` | Last/current detailed unit |
| `rating` | `NUMERIC(3,1)` | Nullable, check 1-10 | User rating |
| `notes` | `TEXT` | Nullable | Private note |
| `started_at` | `TIMESTAMPTZ` | Nullable | First-start time |
| `completed_at` | `TIMESTAMPTZ` | Nullable | Completion time |
| `created_at` | `TIMESTAMPTZ` | NN, default `now()` | Library-add time |
| `updated_at` | `TIMESTAMPTZ` | NN, default `now()` | Last state change |

Unique key: `(user_id, media_item_id)`.

## `progress_events`

| Column | Type | Rules | Description/example |
|---|---|---|---|
| `id` | `UUID` | PK | Event ID |
| `library_entry_id` | `UUID` | NN, FK `library_entries.id` | Entry changed |
| `unit_id` | `UUID` | Nullable, FK `media_units.id` | Unit reached |
| `old_progress` | `NUMERIC(10,2)` | Nullable, check `>= 0` | Previous value |
| `new_progress` | `NUMERIC(10,2)` | NN, check `>= 0` | New value |
| `note` | `TEXT` | Nullable | Optional event note |
| `recorded_at` | `TIMESTAMPTZ` | NN, default `now()` | Event time |

## `sources`

| Column | Type | Rules | Description/example |
|---|---|---|---|
| `id` | `SMALLSERIAL` | PK | Source ID |
| `key` | `VARCHAR(50)` | NN, UQ | `tmdb`, `google-books` |
| `name` | `VARCHAR(100)` | NN, UQ | Display name |
| `connector_kind` | `CONNECTOR_KIND` | NN | API/export/scraper |
| `base_url` | `TEXT` | NN | Official base URL |
| `is_enabled` | `BOOLEAN` | NN, default `true` | Operational toggle |
| `terms_checked_at` | `DATE` | NN | Last policy review date |

## `external_mappings`

| Column | Type | Rules | Description/example |
|---|---|---|---|
| `id` | `UUID` | PK | Mapping ID |
| `media_item_id` | `UUID` | NN, FK `media_items.id` | Canonical record |
| `source_id` | `SMALLINT` | NN, FK `sources.id` | Provider |
| `external_id` | `VARCHAR(255)` | NN | Provider identifier |
| `source_url` | `TEXT` | NN | Attributable record URL |
| `content_hash` | `VARCHAR(128)` | Nullable | Detect material normalized changes |
| `last_synced_at` | `TIMESTAMPTZ` | NN, default `now()` | Last successful sync |

Unique key: `(source_id, external_id)`.

## `ingestion_jobs`

| Column | Type | Rules | Description/example |
|---|---|---|---|
| `id` | `UUID` | PK | Import job ID |
| `requested_by_user_id` | `UUID` | NN, FK `users.id` | Requester/owner |
| `source_id` | `SMALLINT` | Nullable, FK `sources.id` | Null for federated/file imports where appropriate |
| `kind` | `INGESTION_KIND` | NN | Selected results/list URL/file upload |
| `status` | `INGESTION_STATUS` | NN, default `QUEUED` | Job lifecycle |
| `input_reference` | `VARCHAR(500)` | Nullable | Safe URL or original filename; never a token |
| `candidate_count` | `INTEGER` | NN, default 0, check `>= 0` | Parsed candidate total |
| `imported_count` | `INTEGER` | NN, default 0, check `>= 0` | Successfully committed |
| `skipped_count` | `INTEGER` | NN, default 0, check `>= 0` | User/system skipped |
| `failed_count` | `INTEGER` | NN, default 0, check `>= 0` | Invalid/failed candidates |
| `error_code` | `VARCHAR(80)` | Nullable | Stable machine error |
| `error_message` | `TEXT` | Nullable | Safe user/admin diagnostic |
| `requested_at` | `TIMESTAMPTZ` | NN, default `now()` | Queue time |
| `started_at` | `TIMESTAMPTZ` | Nullable | Processing start |
| `completed_at` | `TIMESTAMPTZ` | Nullable | Terminal time |

## `ingestion_candidates`

| Column | Type | Rules | Description/example |
|---|---|---|---|
| `id` | `UUID` | PK | Candidate ID |
| `job_id` | `UUID` | NN, FK `ingestion_jobs.id` | Parent job |
| `source_id` | `SMALLINT` | NN, FK `sources.id` | Candidate provider |
| `external_id` | `VARCHAR(255)` | NN | Provider record ID |
| `media_type_id` | `SMALLINT` | NN, FK `media_types.id` | Normalized type |
| `normalized_payload` | `JSONB` | NN | Validated transient `ProviderMedia` payload |
| `match_media_id` | `UUID` | Nullable, FK `media_items.id` | Probable/exact canonical match |
| `match_confidence` | `NUMERIC(4,3)` | Nullable, check 0-1 | Matching score |
| `proposed_action` | `IMPORT_ACTION` | NN | Create/reuse/review/skip suggestion |
| `decision` | `IMPORT_DECISION` | NN, default `UNDECIDED` | Confirmed user/admin choice |
| `validation_errors` | `JSONB` | NN, default `[]` | Structured staging errors |
| `created_at` | `TIMESTAMPTZ` | NN, default `now()` | Staging time |

Unique key: `(job_id, source_id, external_id)`.

## `recommendations`

| Column | Type | Rules | Description/example |
|---|---|---|---|
| `id` | `UUID` | PK | Recommendation ID |
| `user_id` | `UUID` | NN, FK `users.id` | Recipient |
| `media_item_id` | `UUID` | NN, FK `media_items.id` | Candidate title |
| `score` | `NUMERIC(6,5)` | NN, check 0-1 | Ranked similarity score |
| `model_version` | `VARCHAR(80)` | NN | `genre-vector-v1` |
| `reason` | `TEXT` | NN | Human-readable explanation |
| `feedback` | `RECOMMENDATION_FEEDBACK` | NN, default `NONE` | User feedback |
| `generated_at` | `TIMESTAMPTZ` | NN, default `now()` | Generation time |
| `expires_at` | `TIMESTAMPTZ` | Nullable | Regeneration/cleanup boundary |

## `audit_logs`

| Column | Type | Rules | Description/example |
|---|---|---|---|
| `id` | `BIGSERIAL` | PK | Ordered audit ID |
| `actor_user_id` | `UUID` | Nullable, FK `users.id`, on delete set null | Actor; null may represent system/deleted user |
| `action` | `VARCHAR(100)` | NN | `MANUAL_MEDIA_APPROVED` |
| `entity_type` | `VARCHAR(80)` | NN | `media_item`, `user`, `source` |
| `entity_id` | `VARCHAR(255)` | NN | Entity ID represented as text across key types |
| `old_values` | `JSONB` | Nullable | Relevant previous fields; secrets excluded |
| `new_values` | `JSONB` | Nullable | Relevant new fields; secrets excluded |
| `request_id` | `VARCHAR(100)` | Nullable | Correlates API/log entry |
| `created_at` | `TIMESTAMPTZ` | NN, default `now()` | Immutable event time |

## Dictionary review decisions

- Creator/author/studio normalization is deferred from MVP; `creatorText` may live in provider/manual normalized metadata initially. A future `people`/`media_credits` model requires a new ER revision and migration.
- Provider raw responses are not permanent core data. Only validated normalized staging payloads are stored temporarily.
- Private external access tokens are never columns in this schema; any future connector-token storage requires encryption and a separate security design.
- Prisma migrations must reproduce all checks/indexes, using reviewed raw SQL migrations when Prisma schema syntax cannot express a PostgreSQL feature.
