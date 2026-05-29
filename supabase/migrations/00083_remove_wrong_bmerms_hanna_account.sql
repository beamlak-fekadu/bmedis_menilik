-- Remove only the legacy BMERMS Hanna demo login/roster entry.
-- The BMEDIS/Menelik Hanna account (technician@bmedis-menelik.local) is not touched.

UPDATE profiles
SET
  email = 'removed.hanna.legacy@menelikii.gov.et',
  user_id = NULL,
  is_active = FALSE,
  updated_at = NOW()
WHERE lower(email) IN ('technician@bmerms-demo.local', 'hanna.g@menelikii.gov.et')
  AND lower(email) <> 'technician@bmedis-menelik.local'
  AND full_name = 'Hanna Gebremedhin';

DELETE FROM auth.users
WHERE lower(email) = 'technician@bmerms-demo.local';
