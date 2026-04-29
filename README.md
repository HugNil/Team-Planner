# Team Planner

Private absence list and team planner for bowling clubs.

The app is built for clubs that want a simple QR/link based member page without member accounts, plus an admin area for managing players, teams, absence lists and lineups.

## Features

- Private club page opened through a club link or QR code.
- Members select their name and mark the days they cannot play.
- Weekend rounds are grouped as one round, while absences are stored per play day.
- Absence deadline: Sunday before the match weekend.
- Admin login for club admins/UK.
- Player and team management.
- Optional player nicknames shown in TeamPlanner, while the member absence list keeps full names.
- TeamPlanner with team cards, player pool, 8 player slots, reserve slot, coach field and copyable lineup text.
- Mobile-friendly TeamPlanner: tap a player, then tap a slot.
- Swebowl sync support for importing matches.
- Mock club available through code `TEST`.

## Tech Stack

- Next.js App Router
- TypeScript
- Prisma
- PostgreSQL
- NextAuth
- Tailwind CSS

## Project Structure

```txt
team-planner/
  prisma/                 Prisma schema, migrations and seed scripts
  scripts/                Admin helper scripts
  src/app/                Next.js app, pages and API routes
```

## Requirements

- Node.js 20 or newer
- PostgreSQL database, for example Neon

## Environment Variables

Create `team-planner/.env` locally. Do not commit it.

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
```

For Vercel, set the same variables in Project Settings > Environment Variables. In production, `NEXTAUTH_URL` should be your deployed URL.

## Local Development

```bash
cd team-planner
npm install
npx prisma migrate deploy
npm run db:seed:prod
npm run dev
```

Open:

- Member page: `http://localhost:3000`
- Mock club: `http://localhost:3000/?klubb=TEST`
- Admin: `http://localhost:3000/admin`

## Create an Admin

Create admins through the helper script:

```bash
ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="change-me" ADMIN_CLUB_NAME="BK Allön" npm run admin:create
```

On Windows PowerShell:

```powershell
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="change-me"
$env:ADMIN_CLUB_NAME="BK Allön"
npm run admin:create
```

The script hashes the password with bcrypt before storing it. Admins created this way are regular club admins by default. Set `ADMIN_ROLE="SUPERADMIN"` only when you intentionally want an account that can access every club.

## Database

Apply migrations:

```bash
npx prisma migrate deploy
```

Seed production/demo data:

```bash
npm run db:seed:prod
```

The production seed prepares BK Allön, three teams and a mock `TEST` club. It does not create any admin account.

## Deploy

Recommended deployment:

- Vercel for hosting
- Neon for PostgreSQL

Vercel build command:

```bash
npm run vercel-build
```

The build script runs:

```bash
prisma generate && prisma migrate deploy && next build
```

## Security Notes

- Member pages intentionally do not require login. Anyone with the club link can mark absences for any player in that club.
- Admin pages require login and club access.
- Passwords are hashed with bcrypt.
- Keep `.env`, database URLs, auth secrets and real admin credentials out of Git.
- Rotate secrets immediately if they are ever shared publicly.
