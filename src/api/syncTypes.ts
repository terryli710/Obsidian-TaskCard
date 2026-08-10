// Shapes of the sync bookkeeping that persists in data.json.
//
// Calendar sync is suspended in this release: nothing in the shipped build
// talks to a calendar provider, and the provider modules are dev-only. These
// types stay in the build anyway, because existing users' task-to-event
// mappings and connection settings must survive the upgrade untouched — the
// settings model still has to describe what's on disk so it round-trips.
//
// The provider modules (api/externalAPIManager.ts, api/googleCalendarAPI/,
// api/appleCalendarAPI/, api/pullSyncCore.ts, settings/syncSettings/) import
// these same definitions, so re-wiring the feature needs no type changes.

/** Task fields mirrored to a calendar provider, in canonical on-disk form.
 *  Stored at each sync so a pull engine can tell which side changed. */
export interface SyncFingerprint {
  scheduled: string | null;
  duration: string | null;
}

export type GoogleSyncFingerprint = SyncFingerprint;
export type AppleSyncFingerprint = SyncFingerprint;

/** Per-task provider mappings, keyed by task block id in data.json. */
export interface SyncMappings {
  googleSyncSetting?: {
    id: string;
    calendarId?: string;
    /** Google's `updated` stamp of the last event state we wrote or applied */
    updated?: string;
    /** task fields as of the last successful sync (conflict detection) */
    lastSynced?: GoogleSyncFingerprint;
  };
  appleCalendarSetting?: {
    uid: string;
    eventUrl: string;
    calendarUrl: string;
    etag?: string;
    sequence?: number;
    lastSynced?: AppleSyncFingerprint;
  };
}

export interface SyncSetting {
  isLogin: boolean;
}

export interface GoogleSyncSetting extends SyncSetting {
  clientID: string;
  clientSecret: string;
  doesNeedFilters: boolean;
  filterTag: string;
  filterProject: string;
  defaultCalendarId: string;
}

export interface AppleCalendarSyncSetting extends SyncSetting {
  appleId: string;
  defaultCalendarUrl: string;
  doesNeedFilters: boolean;
  filterTag: string;
  filterProject: string;
}
