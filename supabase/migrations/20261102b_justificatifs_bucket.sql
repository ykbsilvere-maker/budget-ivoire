-- Seau privé pour les justificatifs (reçus, factures). Accès uniquement via la fonction « api »
-- (clé service) : aucune politique publique, anon/authenticated n'y ont pas accès.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('justificatifs', 'justificatifs', false, 6291456,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
