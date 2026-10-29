# Phase 5 Query Plan and Database-Object Evidence

**Captured:** 20 October 2026  
**Database:** PostgreSQL 17 in the project Docker Compose service  
**Dataset:** Repeatable development seed with 6 media items and 3 library entries

This file records representative plans for two common operations. Timings are examples
from one local run and will vary by machine and dataset size.

## Indexes under review

PostgreSQL reported these definitions from `pg_indexes`:

```text
library_entries_user_id_status_updated_at_idx
  btree (user_id, status, updated_at DESC)

media_items_review_status_is_active_created_at_idx
  btree (review_status, is_active, created_at DESC)

media_genres_genre_id_media_item_id_idx
  btree (genre_id, media_item_id)

progress_events_recorded_at_idx
  btree (recorded_at DESC)
```

The schema also has indexes for media title lookup, per-entry progress timelines,
ingestion queues, candidate matches, mappings, recommendations, and audit-log lookup.

## User library status query

Representative query:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT le.id, le.status, le.updated_at
FROM library_entries le
WHERE le.user_id = '00000000-0000-4000-8000-000000000002'::uuid
  AND le.status = 'IN_PROGRESS'
ORDER BY le.updated_at DESC
LIMIT 20;
```

Natural plan on the tiny seed:

```text
Limit  (cost=1.05..1.06 rows=1 width=28) (actual time=0.084..0.085 rows=1 loops=1)
  Buffers: shared hit=4
  ->  Sort  (cost=1.05..1.06 rows=1 width=28) (actual time=0.084..0.084 rows=1 loops=1)
        Sort Key: updated_at DESC
        Sort Method: quicksort  Memory: 25kB
        ->  Seq Scan on library_entries le
              Filter: ((user_id = '00000000-0000-4000-8000-000000000002'::uuid)
                       AND (status = 'IN_PROGRESS'::library_status))
              Rows Removed by Filter: 2
Planning Time: 0.835 ms
Execution Time: 0.120 ms
```

PostgreSQL correctly chooses a sequential scan for a three-row table. To verify that the
index is usable, `enable_seqscan` was disabled only in the documentation session:

```text
Limit  (cost=0.13..8.15 rows=1 width=28) (actual time=0.009..0.009 rows=1 loops=1)
  ->  Index Scan using library_entries_user_id_updated_at_idx on library_entries le
        Index Cond: (user_id = '00000000-0000-4000-8000-000000000002'::uuid)
        Filter: (status = 'IN_PROGRESS'::library_status)
        Rows Removed by Filter: 1
Planning Time: 0.024 ms
Execution Time: 0.022 ms
```

Both the `(user_id, updated_at)` and `(user_id, status, updated_at)` indexes support
library screens. At realistic size, `ANALYZE` statistics determine which is cheaper for a
particular status distribution.

## Manual-submission review queue

Representative query:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT mi.id, mi.title, mi.created_at
FROM media_items mi
WHERE mi.review_status = 'PENDING_REVIEW'
  AND mi.is_active = TRUE
ORDER BY mi.created_at DESC
LIMIT 20;
```

Natural plan on six media rows:

```text
Limit  (cost=1.08..1.09 rows=1 width=540) (actual time=0.078..0.079 rows=1 loops=1)
  ->  Sort  (cost=1.08..1.09 rows=1 width=540) (actual time=0.078..0.078 rows=1 loops=1)
        Sort Key: created_at DESC
        Sort Method: quicksort  Memory: 25kB
        ->  Seq Scan on media_items mi
              Filter: (is_active AND (review_status = 'PENDING_REVIEW'::review_status))
              Rows Removed by Filter: 5
Planning Time: 0.222 ms
Execution Time: 0.086 ms
```

Index-verification plan from the same session:

```text
Limit  (cost=0.13..8.15 rows=1 width=540) (actual time=0.040..0.041 rows=1 loops=1)
  Buffers: shared hit=1 read=1
  ->  Index Scan using media_items_review_status_is_active_created_at_idx on media_items mi
        Index Cond: ((review_status = 'PENDING_REVIEW'::review_status)
                     AND (is_active = true))
Planning Time: 0.013 ms
Execution Time: 0.047 ms
```

The index matches both filters and the requested descending order, avoiding a separate
sort when the review queue grows.

## How to reproduce

Run each query above through `psql` after migration and seeding. To check index usability
without changing permanent database configuration:

```sql
SET enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;
RESET enable_seqscan;
```

`enable_seqscan = off` is a diagnostic aid, not a production setting. After loading a
larger dataset, run `ANALYZE` and capture the natural plans again.

## Other required database objects

The migration `20261020080000_phase5_database_features` also creates:

- `user_library_summary`, joining a user's library state to canonical media and computed
  progress percentage.
- `media_popularity_summary`, aggregating library count, completion count, rating, and
  last activity for each active title.
- `get_user_genre_profile(uuid)`, returning ranked genre preference evidence.
- `library_entry_update_audit_trigger`, inserting old and new library-entry values into
  `audit_logs` after updates.

Useful demonstration queries:

```sql
SELECT *
FROM user_library_summary
WHERE user_id = '00000000-0000-4000-8000-000000000002';

SELECT *
FROM media_popularity_summary
ORDER BY library_count DESC, title;

SELECT *
FROM get_user_genre_profile('00000000-0000-4000-8000-000000000002');
```

The integration suite verifies the audit trigger and verifies that a failed multi-item
import confirmation leaves every candidate and job count unchanged.
