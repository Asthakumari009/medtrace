-- On-device text recognition.
--
-- A report read by ML Kit on the phone has no stored file: only the extracted
-- text is sent to the API, so file_path must be allowed to be null. The source
-- is recorded per report because the app states it to the user, and the claim
-- has to be verifiable from the data rather than from the UI.

alter table public.reports
  alter column file_path drop not null;

alter table public.reports
  add column if not exists extraction_source text not null default 'cloud';

alter table public.reports
  drop constraint if exists reports_extraction_source_check;

alter table public.reports
  add constraint reports_extraction_source_check
  check (extraction_source in ('cloud', 'on_device_ocr'));

-- A cloud-read report must keep its file; an on-device one must not have one.
alter table public.reports
  drop constraint if exists reports_file_path_matches_source;

alter table public.reports
  add constraint reports_file_path_matches_source
  check (
    (extraction_source = 'cloud' and file_path is not null)
    or (extraction_source = 'on_device_ocr' and file_path is null)
  );
