# Mail Bassthalk — Security Review (2026-11-03)

## Scope
Read-only review of branch `feature/call-follow-up`, the connected Supabase project, its live RLS policies, grants, migrations, storage bucket, and Supabase security/performance advisors. No source files on the existing branch were rewritten.

## Applied fix
- Restricted `public.message_recipients` for `authenticated` to SELECT plus column-level UPDATE on `read_at` only.
- Revoked all table privileges on that table from `anon` and `authenticated` before granting back the minimum required permissions.
- Reason: the previous table-level UPDATE grant allowed a signed-in recipient to change `message_id` or `recipient_id` on their own row. The RLS policy checked that `recipient_id` remained the current user, but did not prevent changing `message_id`.
- Verification after applying migration: table-level UPDATE is false; UPDATE on `message_id` is false; UPDATE on `recipient_id` is false; UPDATE on `read_at` is true; anon SELECT is false.

## Current positive controls observed
- Public application tables have RLS enabled.
- The `sheets` Storage bucket exists and is private.
- Message visibility policy limits messages to sender or recipient.
- The SECURITY DEFINER helper functions compare the supplied user ID to `auth.uid()` before checking roles or participation.
- No populated message, recipient, or call-follow-up records were present during this review.

## Remaining issues to address
1. **Sheet viewer is not a complete no-download control.** The server parses spreadsheet data and returns up to 3,000 rows × 60 columns to the browser. The browser can inspect/copy any values it is allowed to view. `ProtectedSheet` also embeds and opens external Google Sheets URLs directly, where this app cannot enforce Google's download/print/copy settings. Use paginated server-side viewing for uploaded files, and clearly treat Google Sheets links as externally governed.
2. **Upload validation improved on the review branch.** The review branch now caps uploads at 10 MiB, limits sends to 100 unique recipients, verifies recipient IDs against profiles, rejects simultaneous file + Google Sheet attachments, and performs best-effort cleanup if a send partially fails. This code change has a passing Vercel preview build, but it is not merged into the live application yet. Database-level transactionality and malware/content inspection remain future work.
3. **Initial supervisor bootstrap is public while no supervisor exists.** It is intended for first-run setup and becomes unavailable after a supervisor exists, but simultaneous first-run requests are not serialized. Consider a one-time deployment bootstrap secret or an atomic database-backed setup lock before using this on an open production URL.
4. **Password hardening setting:** Supabase Auth leaked-password protection is disabled. Enable it in the Auth password/security settings.
5. **Advisor warnings:** Supabase reports four SECURITY DEFINER helper functions callable by authenticated users. Their current definitions check `_user_id = auth.uid()`, so callers cannot use them to query another user's identity, but the warnings should remain documented and the functions should stay narrowly scoped.
6. **Automated database security tests:** pgTAP is not installed in the connected database. Add a repeatable RLS/privilege test setup before making further policy changes.
7. **Repository visibility:** the GitHub repository is currently public. No populated values were found in the tracked `.env` file during this review, but source code and project structure are publicly readable. Make the repository private if this is internal company software.

## Change safety
The database fix is represented by `supabase/migrations/20261103053000_restrict_message_recipient_updates.sql`. This review branch is separate from the currently deployed feature branch. Do not merge unrelated UI or schema changes without a preview build and two-account authorization tests.
