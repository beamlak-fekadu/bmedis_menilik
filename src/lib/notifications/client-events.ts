'use client';

export const NOTIFICATIONS_UPDATED_EVENT = 'bmedis:notifications-updated';
const NOTIFICATIONS_CHANNEL = 'bmedis-notifications';

export function publishNotificationsUpdated(source = 'local'): void {
  if (typeof window === 'undefined') return;
  const detail = { source, at: Date.now() };
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT, { detail }));
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(NOTIFICATIONS_CHANNEL);
    channel.postMessage(detail);
    channel.close();
  }
}

export function subscribeToNotificationUpdates(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handleWindowEvent = () => callback();
  window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handleWindowEvent);

  let channel: BroadcastChannel | null = null;
  if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel(NOTIFICATIONS_CHANNEL);
    channel.onmessage = () => callback();
  }

  return () => {
    window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handleWindowEvent);
    channel?.close();
  };
}

