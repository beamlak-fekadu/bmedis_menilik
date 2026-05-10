import { redirect } from 'next/navigation';

export default function SecurityRedirectPage() {
  redirect('/settings?tab=security-access');
}
