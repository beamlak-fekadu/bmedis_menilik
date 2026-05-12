'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { updateCalibrationRequestStatusAction } from '@/actions/calibration.actions';

interface CalibrationRequestActionsProps {
  requestId: string;
  assetId: string;
  calibrationTypeId?: string | null;
  status: string;
  canMutate: boolean;
}

export default function CalibrationRequestActions({ requestId, assetId, calibrationTypeId, status, canMutate }: CalibrationRequestActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function updateStatus(nextStatus: string) {
    setBusy(nextStatus);
    const result = await updateCalibrationRequestStatusAction(requestId, nextStatus);
    setBusy(null);
    if (!result.success) {
      toast('error', result.error ?? 'Failed to update calibration request');
      return;
    }
    toast('success', 'Calibration request updated');
    router.refresh();
  }

  const recordParams = new URLSearchParams({
    requestId,
    assetId,
    source: 'calibration-request',
    action: 'record-result',
  });
  if (calibrationTypeId) recordParams.set('calibrationTypeId', calibrationTypeId);

  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/equipment/${assetId}`}>
        <Button variant="outline" size="sm">Open Asset Profile</Button>
      </Link>
      {canMutate && status === 'pending' && (
        <>
          <Button size="sm" loading={busy === 'approved'} onClick={() => updateStatus('approved')}>Approve</Button>
          <Button variant="destructive" size="sm" loading={busy === 'rejected'} onClick={() => updateStatus('rejected')}>Reject</Button>
        </>
      )}
      {canMutate && status === 'approved' && (
        <>
          <Link href={`/calibration/records/new?${recordParams.toString()}`}>
            <Button size="sm">Schedule Calibration</Button>
          </Link>
          <Button variant="info" size="sm" loading={busy === 'in_progress'} onClick={() => updateStatus('in_progress')}>Mark In Progress</Button>
        </>
      )}
      {canMutate && status === 'in_progress' && (
        <Link href={`/calibration/records/new?${recordParams.toString()}`}>
          <Button variant="success" size="sm">Record Calibration Result</Button>
        </Link>
      )}
      {!['pending', 'approved', 'in_progress'].includes(status) && (
        <Link href={`/calibration?tab=requests&requestId=${requestId}`}>
          <Button variant="outline" size="sm">Review Request Evidence</Button>
        </Link>
      )}
    </div>
  );
}
