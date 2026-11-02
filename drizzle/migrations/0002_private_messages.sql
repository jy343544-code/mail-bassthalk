CREATE OR REPLACE FUNCTION public.is_sender(_message_id uuid, _user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.messages WHERE id = _message_id AND sender_id = _user_id) $$;
DROP POLICY IF EXISTS "messages visible" ON public.messages;
CREATE POLICY "messages visible" ON public.messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR public.is_recipient(id, auth.uid()));
DROP POLICY IF EXISTS "recipients visible" ON public.message_recipients;
CREATE POLICY "recipients visible" ON public.message_recipients FOR SELECT TO authenticated USING (recipient_id = auth.uid() OR public.is_sender(message_id, auth.uid()));