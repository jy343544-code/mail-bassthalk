-- Pin privileged role helper functions to an empty search_path.
-- Keep their authenticated-only EXECUTE grants; application checks and RLS policies depend on them.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT _user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_recipient(_message_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT _user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.message_recipients
      WHERE message_id = _message_id AND recipient_id = _user_id
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_sender(_message_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT _user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.messages
      WHERE id = _message_id AND sender_id = _user_id
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT _user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id AND role IN ('supervisor', 'manager')
    );
$function$;
