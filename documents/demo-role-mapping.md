# BMERMS Demo Role Mapping

This document is the canonical reference for the seven BMERMS demo login accounts: which Supabase Auth email maps to which profile name, job title, and **database role**.

## Job titles are not database roles

BMERMS keeps two distinct concepts separate:

- **Job title** — free-text label stored in `profiles.job_title`. Used for display only. Examples: `Clinical Engineer`, `Radiologist`, `ICU Head`, `Biomedical Engineering Head`, `Medical Director`, `Thesis Developer`, `Medical Equipment Store Officer`.
- **Database role** — one of exactly eight lowercase role names stored in `roles.name` and assigned via `user_roles`. RLS policies and the app's `useRole()` hook only look at these:

  ```
  developer
  admin
  bme_head
  technician
  department_head
  department_user
  store_user
  viewer
  ```

Do **not** invent new roles like `clinical_engineer`, `radiologist`, or `icu_head`. Those are job titles.

## Final demo login mapping

| Email | Profile `full_name` | Profile `job_title` | Database role |
|---|---|---|---|
| `developer@bmerms-demo.local` | BMERMS Developer | Thesis Developer | `developer` |
| `bme.head@bmerms-demo.local` | Ermias Tadesse | Biomedical Engineering Head | `bme_head` |
| `technician@bmerms-demo.local` | Hanna Gebremedhin | Clinical Engineer | `technician` |
| `department.head@bmerms-demo.local` | Tigist Worku | ICU Head | `department_head` |
| `department.user@bmerms-demo.local` | Dr. Fitsum Haile | Radiologist | `department_user` |
| `store.user@bmerms-demo.local` | Ato Biniam Teshome | Medical Equipment Store Officer | `store_user` |
| `viewer@bmerms-demo.local` | Dr. Amanuel Kifle | Medical Director | `viewer` |

Notes:

- The previous `BME Department Head` placeholder name and the `Sr. Tigist Worku` / `ICU Head Nurse` strings are no longer used; they are overwritten by both the seed and the live SQL script.
- The two department-scoped accounts (`department.head@*` and `department.user@*`) are attached to an active ICU department when one exists. Other demo accounts have a NULL department.

## Topbar / display rules

The top-right of the app should show, in this order:

1. `profile.full_name` (large line)
2. Formatted role label (small line)

Examples:

- Ermias Tadesse / BME Head
- Hanna Gebremedhin / Technician
- Tigist Worku / Department Head
- Dr. Fitsum Haile / Department User
- Dr. Amanuel Kifle / Viewer

Raw lowercase role names (`bme_head`, `department_head`, `store_user`) must not appear in non-developer UI. The Topbar runs role strings through `formatRoleName` in [src/utils/roles.ts](../src/utils/roles.ts), which maps:

```
bme_head        -> BME Head
admin           -> Admin
developer       -> Developer
technician      -> Technician
department_head -> Department Head
department_user -> Department User
store_user      -> Store User
viewer          -> Viewer
```

## Applying this mapping to the live Supabase database

1. Make sure the seven Supabase Auth users exist in `auth.users` (Supabase Dashboard → Authentication → Users). The emails must exactly match the table above.
2. Open the Supabase SQL Editor and paste the contents of [apply-demo-role-mapping.sql](apply-demo-role-mapping.sql).
3. Run it. The script is transactional and idempotent — re-running it is safe.
4. Inspect the validation rows at the end. Every row should show `status = 'OK'`.

The script:

- Ensures all eight application roles exist.
- Looks up `auth.users.id` by **email** (no hardcoded auth UUIDs).
- Updates existing profiles and FORCES the intended `full_name` / `job_title`.
- Inserts a profile only when the auth user exists (no NULL-`user_id` rows for demo logins).
- Clears any prior `user_roles` for the seven demo profiles and assigns exactly one intended role per profile.

## Validating without changing data

Run [validate-demo-role-mapping.sql](validate-demo-role-mapping.sql) any time you want to confirm the state. It is read-only.

Status values it can emit per row:

- `OK`
- `MISSING AUTH USER` — `auth.users` row not found for the demo email.
- `MISSING PROFILE` — no `profiles` row by email.
- `PROFILE NOT LINKED TO AUTH` — `profiles.user_id` is NULL or does not match `auth.users.id`.
- `WRONG NAME` — `profiles.full_name` does not match the expected value.
- `WRONG JOB TITLE` — `profiles.job_title` does not match the expected value.
- `WRONG ROLE` — assigned `user_roles` does not include the expected lowercase role.
- `MULTIPLE ROLES` — more than one role assigned (demo profiles must have exactly one).

## If the app still shows the old role after the SQL is correct

The Supabase client caches the auth session in the browser. After updating profiles/roles:

- Log out and log back in, **or**
- Clear the site data for the deployment (DevTools → Application → Storage → Clear site data), **or**
- Use an incognito / private window for the new sign-in.

The Topbar reads `profile.full_name` and `profile.primaryRole` from the `profiles` and `user_roles` tables via `useProfile()`. Once those rows are correct in the database and the auth session is refreshed, the display updates automatically.

## Where this lives in the codebase

- Seed (local + `supabase db push`): [supabase/seed/100_demo_role_users.sql](../supabase/seed/100_demo_role_users.sql)
- Live apply script (Supabase SQL Editor): [documents/apply-demo-role-mapping.sql](apply-demo-role-mapping.sql)
- Live validation script (read-only): [documents/validate-demo-role-mapping.sql](validate-demo-role-mapping.sql)
- Role label formatter: [src/utils/roles.ts](../src/utils/roles.ts)
- Topbar display: [src/components/layout/Topbar.tsx](../src/components/layout/Topbar.tsx)
- Settings UI role display: [src/app/(dashboard)/settings/page.tsx](../src/app/(dashboard)/settings/page.tsx)
