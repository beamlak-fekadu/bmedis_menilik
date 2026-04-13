import { redirect } from 'next/navigation';

export default async function EquipmentEditRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/inventory/${id}/edit`);
}
