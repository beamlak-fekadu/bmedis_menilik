# Demo Auth Linking (Supabase Hosted)

This project seeds demo `profiles`, `roles`, and `user_roles`, but `profiles.user_id` is intentionally `NULL` in seed data.
RLS and role checks use `auth.uid()`, so you must link seeded profiles to real Auth users for live demo logins.

## Why this is required

- `profiles.user_id` stores the real `auth.users.id` UUID.
- RLS helper `auth_user_has_role(...)` resolves roles through `profiles.user_id = auth.uid()`.
- Client/server profile hooks also fetch profile by `profiles.user_id`.

Without linking, authenticated demo users will not resolve to seeded profile/roles.

## Demo accounts to link

Use one seeded profile per demo role:

| Role | Seeded profile email | Purpose in demo |
| --- | --- | --- |
| admin | `ermias.tadesse@yekatit12.gov.et` | Full access, governance, user and settings management |
| technician | `hanna.g@yekatit12.gov.et` | Maintenance/PM/calibration and technical workflows |
| department_user | `tigist.w@yekatit12.gov.et` | Department-scoped request and clinical operations view |
| store_user | `biniam.t@yekatit12.gov.et` | Spare parts and logistics workflows |
| viewer | `amanuel.k@yekatit12.gov.et` | Read-only dashboard/report access |

## Step-by-step setup

1. Open Supabase Dashboard for your project.
2. Go to **Authentication -> Users**.
3. Create one Auth user for each role above.
4. Use the same email as the seeded profile email.
5. Set demo passwords for each account.
6. Copy each Auth user's UUID (`auth.users.id`).
7. Open **SQL Editor**.
8. Open `supabase/seed/99_link_auth_users.sql`.
9. Replace each `REPLACE_WITH_*_AUTH_UUID` placeholder with the real UUID.
10. Run the script.
11. Confirm post-check output shows non-null `profiles.user_id` for all expected demo emails.
12. Log in with each demo account and verify role-gated access.

## SQL file to run

Run:

- `supabase/seed/99_link_auth_users.sql`

This script includes:

- before/after inspection queries,
- updates for each demo role profile by email,
- null-link checks,
- duplicate `user_id` checks,
- role mapping validation (including department linkage visibility).

## Notes

- Do not insert directly into `auth.users` from standard seed SQL on hosted Supabase.
- Re-running the linking script is safe when UUID mappings are unchanged (idempotent updates).
- If you prefer a different seeded person for a role (for example another technician), edit the email mapping in the SQL file accordingly.
