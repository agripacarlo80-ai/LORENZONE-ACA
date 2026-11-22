import { PublicProfile } from '../types';

export const ONLINE_THRESHOLD_MS = 95_000;

export function timestampToMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export function formatLastSeen(lastSeenMs: number, nowMs: number): string {
  if (!lastSeenMs) return 'No recent activity';
  const diffSec = Math.max(0, Math.floor((nowMs - lastSeenMs) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export interface StudentPresence {
  isOnline: boolean;
  label: 'Online' | 'Offline';
  lastSeenText: string;
}

export function getStudentPresence(
  profile: PublicProfile,
  nowMs: number = Date.now()
): StudentPresence {
  const lastSeenMs = timestampToMillis(profile.lastSeenAt);
  const recentHeartbeat = lastSeenMs > 0 && nowMs - lastSeenMs <= ONLINE_THRESHOLD_MS;
  const isOnline = profile.isOnline === true && recentHeartbeat;

  return {
    isOnline,
    label: isOnline ? 'Online' : 'Offline',
    lastSeenText: isOnline ? 'Active now' : formatLastSeen(lastSeenMs || timestampToMillis(profile.updatedAt), nowMs),
  };
}
