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
| admin | `bme.head@bmerms-demo.local` | Full access, governance, user and settings management (acts as BME Head) |
| technician | `technician@bmerms-demo.local` | Maintenance/PM/calibration and technical workflows |
| department_user | `department.user@bmerms-demo.local` | Department-scoped request and clinical operations view |
| store_user | `store.user@bmerms-demo.local` | Spare parts and logistics workflows |
| viewer | `viewer@bmerms-demo.local` | Read-only dashboard/report access |

Additional Supabase Auth logins exist for `developer@bmerms-demo.local` and
`department.head@bmerms-demo.local`. They are not mapped by this seed script
because the corresponding roles (`developer`, `department_head`) are not
present in the base seed — `developer` is provisioned by migration 00022, and
`department_head` would require a future role-adding migration.

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

## Expected validation results

After running the SQL file:

- The "Any expected profile still missing user_id?" query should return zero rows.
- The "Duplicate user_id links" query should return zero rows.
- The role mapping validation should show `has_expected_role = true` for all five demo accounts.
- Logging in as each demo account should load a non-viewer role where expected in the sidebar and chatbot context.

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
- Keep real Auth UUIDs out of committed seed files unless they are intentionally tied to a disposable demo project.
