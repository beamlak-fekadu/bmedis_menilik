import { redirect } from 'next/navigation';

export default function HelpdeskRedirectPage() {
  redirect('/requests');
}
