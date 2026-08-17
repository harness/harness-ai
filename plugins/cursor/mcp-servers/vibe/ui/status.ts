import type { StatusBadgeTheme } from '@harnessio/ui/components';
import type { EnvTone, StageRailStatus } from './deployment-card';

export function statusTheme(status: string): StatusBadgeTheme {
  switch (status) {
    case 'failed':
      return 'danger';
    case 'succeeded':
    case 'preview_ready':
    case 'published':
    case 'completed':
      return 'success';
    case 'running':
    case 'processing':
    case 'queued':
      return 'info';
    case 'paused':
    case 'awaiting_approval':
      return 'warning';
    case 'canceled':
    case 'cancelled':
    case 'skipped':
      return 'muted';
    default:
      return 'muted';
  }
}

export function envToneTheme(tone: EnvTone): StatusBadgeTheme {
  switch (tone) {
    case 'ok':
      return 'success';
    case 'err':
      return 'danger';
    case 'warn':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return 'muted';
  }
}

export function stageTitleColor(
  status: StageRailStatus,
): 'danger' | 'warning' | 'foreground-1' | 'foreground-2' | 'foreground-3' {
  switch (status) {
    case 'failed':
      return 'danger';
    case 'held':
      return 'warning';
    case 'active':
      return 'foreground-1';
    case 'done':
      return 'foreground-2';
    default:
      return 'foreground-3';
  }
}
