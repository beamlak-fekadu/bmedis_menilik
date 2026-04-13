import { redirect } from 'next/navigation';

export default function EquipmentCreateRedirect() {
  redirect('/inventory/new');
}
