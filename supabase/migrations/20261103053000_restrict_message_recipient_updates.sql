-- Restrict message recipient updates to the read marker only.
-- The previous table-level UPDATE grant allowed a recipient to change message_id
-- or recipient_id on their own row and potentially gain access to another message.
REVOKE ALL PRIVILEGES ON TABLE public.message_recipients FROM anon, authenticated;
GRANT SELECT ON TABLE public.message_recipients TO authenticated;
GRANT UPDATE (read_at) ON TABLE public.message_recipients TO authenticated;
