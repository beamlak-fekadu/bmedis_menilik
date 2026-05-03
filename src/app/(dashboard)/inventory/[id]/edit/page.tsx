import { redirect } from 'next/navigation';

export default async function InventoryEditRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/equipment/${id}/edit`);
}
