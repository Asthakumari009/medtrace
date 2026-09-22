-- Clinical details the deck promises but the schema never held: who wrote the
-- document, where, what it concluded, and what was prescribed.
--
-- These live on `reports` rather than in their own tables on purpose. A report
-- is the only thing that produces them, they are always read alongside it
-- (chat grounding, the report screen, the doctor share), and `reports` already
-- carries the row-level security that governs them. A separate table would add
-- four policies and a second retry-cleanup step to store a list that is never
-- queried on its own.

alter table public.reports
  add column if not exists doctor_name   text,
  add column if not exists facility_name text,
  add column if not exists diagnoses     text[] not null default '{}',
  add column if not exists medications   jsonb  not null default '[]'::jsonb;

-- Each medication is {name, dose?, frequency?, duration?}; `name` is the only
-- required key. Pydantic validates that shape before anything is written; this
-- constraint is only the backstop that keeps a non-array out of the column.
-- (Per-element checks would need a subquery, which Postgres forbids here.)
alter table public.reports
  drop constraint if exists reports_medications_shape;
alter table public.reports
  add constraint reports_medications_shape
    check (jsonb_typeof(medications) = 'array');

comment on column public.reports.doctor_name   is 'Prescribing/reporting clinician printed on the document, if any.';
comment on column public.reports.facility_name is 'Hospital, clinic or lab printed on the document, if any.';
comment on column public.reports.diagnoses     is 'Conditions stated on the document. Never inferred by the model.';
comment on column public.reports.medications   is 'Array of {name, dose?, frequency?, duration?} exactly as printed.';
