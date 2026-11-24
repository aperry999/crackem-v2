# Crackem v2

The rebuilt Crackem app: real-time brewery discovery ("what's on tonight near me"), with city
completion and surprise rewards. Replaces the Bubble app and ships as an update to the same
store listings.

| | |
| --- | --- |
| iOS bundle ID | `com.reviox.reviox` (last Bubble build: 2.10, build 1) |
| Android package | `com.revioxapp.revioxapp` (Play App Signing on; Google holds the signing key) |
| App | Expo (React Native, TypeScript, Expo Router), built and submitted with EAS |
| Backend | Supabase: Postgres + PostGIS, email-code login, row-level security |
| Events | The nightly Python pipeline (What's Crackin'), loaded by `pipeline/load_app_db.py` |

## Layout

- `src/app/` screens: Tonight (with the nearby-breweries fallback), Nearby, venue page with tier,
  check-in result with the surprise reward, My city, You (sign in, account deletion).
- `src/lib/` Supabase client, API calls, location and session hooks.
- `supabase/migrations/` the schema and the functions the app calls (`tonight_feed`,
  `nearby_venues`, `check_in`, `open_reward`, `city_progress`, `flag_on`).
- `pipeline/load_app_db.py` copies the nightly run's venues and events into the database.

## Rules baked into the code

- Google data: only the place ID is stored. Venue hours come from the brewery's website
  (schema.org) or the brewery's own profile, never from Google. Venues with neither show no times.
- Check-in only within 150 m of the venue, once per venue per 4 hours.
- Rewards are a surprise, at most one a week, and only Crackem-funded ones are granted until the
  attorney's tied-house opinion is in.
- The server-side switch is the `flags` table: `enabled` turns a feature on for everyone,
  `flag_users` turns it on for testers only. No new build needed.
- Login is a 6-digit email code. Bubble passwords can't be exported, so existing users sign in
  with the same email and their migrated history is matched to it.

## Running it

```bash
npm install
cp .env.example .env        # fill in the Supabase URL and anon key
npx expo start
npm run typecheck
```

Database: create a Supabase project, then `supabase db push` (or paste the migration into the
SQL editor). Loader: `python3 pipeline/load_app_db.py --dry-run` prints counts without writing;
without `--dry-run` it needs `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`.

Builds: `npx eas-cli@latest build --profile preview`. Version numbers are kept by EAS
(`appVersionSource: remote`); before the first store build, set them above the Bubble app's
last numbers with `eas build:version:set`.
