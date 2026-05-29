-- Remove only the legacy BMERMS Hanna demo login.
-- The BMEDIS/Menelik Hanna account (technician@bmedis-menelik.local) is not touched.

UPDATE profiles
SET
  email = 'hanna.g@menelikii.gov.et',
  user_id = NULL,
  updated_at = NOW()
WHERE lower(email) = 'technician@bmerms-demo.local';

DELETE FROM auth.users
WHERE lower(email) = 'technician@bmerms-demo.local';
