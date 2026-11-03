# Mail Bassthalk

https://lovable.dev/preview/5QFXtHRCGuO3dtOhSTgenLCnUFOnjrvY

انا عايز اكمل شغل علي المشروع ده و يكون الشيت بيتفتح لكل ملف من المتصفح و ممنوع تنزيل اي تفاصيل الي ناقص كملو و عدل الثيم خلي شكلو حلو بس كده

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mail-bassthalk.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a0ed2d4c-ab57-460e-86fe-043f7b1c4367).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```


## Deploy to Vercel

This repository is configured for **TanStack Start on Vercel using Nitro**.

1. Import this GitHub repository in Vercel.
2. Select the branch `feature/call-follow-up` for a Preview deployment first. Do not change the Production Branch to this feature branch unless you intentionally want it to become production.
3. Keep the Framework Preset as **TanStack Start**. Vercel should detect the build command and output settings automatically.
4. In Vercel → Project → Settings → Environment Variables, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
5. Add the values for Preview and Production environments as needed. Use the same Supabase project that contains the app's schema and authentication users.
6. Deploy a Preview, then test login, inbox, sending messages, attachments, permissions, and call follow-up before promoting anything to Production.

Use `.env.example` as a key-name reference. Do not commit real credentials. Values beginning with `VITE_` are public in the browser bundle; never put service-role keys or other private secrets in them.

### Database

Before testing call follow-up, apply the SQL migration in `drizzle/migrations/0003_call_followup.sql` to the connected Supabase database, after reviewing it against the current schema and backup. Confirm storage bucket names and RLS policies match the deployed project.

### Local build

Use Node.js 20 or newer, then run:

```sh
npm install
npm run build
npm run preview
```

The daily Quran verse is selected by UTC date so all signed-in users see the same verse on a given day. The animated background is CSS-only and respects reduced-motion settings.
