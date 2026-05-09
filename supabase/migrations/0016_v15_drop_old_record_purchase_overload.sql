-- v1.5 follow-up: PostgREST can't resolve which overload to call when both
-- the old 4-arg and the new 5-arg signatures exist. Drop the old one.
drop function if exists public.record_purchase(text, text, date, jsonb);
