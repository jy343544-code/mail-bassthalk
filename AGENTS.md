<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Rules
- Accounts sign in by username mapped to a synthetic email (src/lib/identity.ts); public signup is disabled and only server functions create users. Why: supervisor-provisioned accounts only.
- Roles live in public.user_roles (supervisor/manager/employee); every privileged server function re-checks role via has_role. Why: prevent privilege escalation.
- Sheet files are never sent to the browser raw: the private `sheets` bucket is read only by server functions that parse to rows after an RLS check. Why: no-download requirement.
- UI is Arabic RTL.
- All important actions are written to public.activity_log (server functions via admin client; a fixed allowlist of client-side actions via RLS). Why: supervisor-only full audit trail.
- Only employees/managers can request a password reset (password_reset_requests row the supervisor resolves); supervisors have no self-service recovery. Why: user decision, accounts have no real email.
