# FEAR Bets

In-game parimutuel racing betting for the Executive FiveM roleplay server, created and managed by FEAR. No real money — accounts are issued by admins, deposits/withdrawals are confirmed in-game, and there's no self-registration.

## Stack

- [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- [Drizzle ORM](https://orm.drizzle.team/) + `postgres` driver
- Supabase Postgres, accessed via Supavisor's transaction pooler (port 6543) so it's safe from serverless functions
- [iron-session](https://github.com/vvo/iron-session) for auth, [Zod](https://zod.dev/) for validation

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and SESSION_SECRET, see comments in .env.example
npm run db:migrate      # apply migrations
npm run db:seed         # bootstrap the Owner role + first admin account (prints a one-time temp password)
npm run dev
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run db:generate` | Diff `lib/db/schema.js` and write a new migration under `drizzle/` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio against the configured database |
| `npm run db:seed` | One-time bootstrap for a fresh database (see `lib/db/seed.js`) |

## Deployment

Deployed on Vercel. `vercel.json` pins serverless functions to the `syd1` region to stay close to the Supabase project's `ap-southeast-2` region — every DB round-trip crossing further than that adds real, noticeable latency. If the Supabase project ever moves region, update `vercel.json` to match.

## Accounts

There's no self-registration. An admin creates each account from the admin panel and hands the player a temporary password; the player is forced to set their own password on first login.
