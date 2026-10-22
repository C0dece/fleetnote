import { create } from "zustand";
import type { VaultFs } from "@/core/fs/types";
import { SyncEngine, type SyncState as EngineState } from "@/core/sync/syncEngine";
import { createAdapter } from "@/core/sync/adapters";
import type { AdapterId } from "@/core/sync/types";
import type { VaultProfile } from "@/core/vault/profiles";
import { saveProfile } from "@/core/vault/profiles";
import { isSecretField, restoreSecrets, stashSecrets } from "@/core/secrets";
import { settings, useSettingsStore, type SyncDirection } from "./settingsStore";

interface SyncStoreState {
  engine: SyncEngine | null;
  profile: VaultProfile | null;
  status: EngineState;
  busy: boolean;
  lastError?: string;

  attach(fs: VaultFs, profile: VaultProfile, onRemoteChange: () => Promise<void>): Promise<void>;
  connect(adapter: AdapterId, options: Record<string, string>): Promise<boolean>;
  disconnect(): Promise<void>;
  syncNow(direction?: SyncDirection): Promise<void>;
  notifyChange(path: string): void;
  notifyDelete(path: string): void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeSettings: (() => void) | null = null;

export const useSyncStore = create<SyncStoreState>((set, get) => ({
  engine: null,
  profile: null,
  status: { status: "off", pending: 0, conflicts: [] },
  busy: false,

  async attach(fs, profile, onRemoteChange) {
    get().engine?.dispose();
    if (pollTimer) clearInterval(pollTimer);
    unsubscribeSettings?.();

    const engine = new SyncEngine(fs);
    engine.onState((status) => set({ status }));
    engine.configure({
      pushDebounceMs: settings().sync.pushDebounceMs,
      direction: settings().sync.direction,
      conflict: settings().sync.conflict,
    });
    // Настройки синхронизации применяются на лету, без перезапуска
    unsubscribeSettings = useSettingsStore.subscribe((state) =>
      engine.configure({
        pushDebounceMs: state.sync.pushDebounceMs,
        direction: state.sync.direction,
        conflict: state.sync.conflict,
      }),
    );
    set({ engine, profile, lastError: undefined });

    if (profile.adapter && profile.options) {
      try {
        // Пароли и токены живут в хранилище секретов, в профиле остаются только открытые поля
        const full = await restoreSecrets(profile.id, profile.options);
        if (Object.keys(profile.options).some(isSecretField)) {
          const safe = await stashSecrets(profile.id, profile.options);
          const cleaned = { ...profile, options: safe };
          saveProfile(cleaned);
          set({ profile: cleaned });
        }
        const adapter = await createAdapter(profile.adapter);
        await adapter.connect(full);
        await engine.setAdapter(adapter);
        if (settings().sync.syncOnStart) {
          const report = await engine.syncAll();
          if (report && (report.pulled.length || report.merged.length || report.conflicted.length)) {
            await onRemoteChange();
          }
        }
      } catch (error) {
        set({ lastError: error instanceof Error ? error.message : String(error) });
      }
    }

    const schedulePoll = () => {
      if (pollTimer) clearInterval(pollTimer);
      const { auto, intervalMin } = settings().sync;
      if (!auto) return;
      pollTimer = setInterval(
        () => {
          void (async () => {
            const report = await get().engine?.syncAll();
            if (report && (report.pulled.length || report.merged.length)) await onRemoteChange();
          })();
        },
        Math.max(1, intervalMin) * 60 * 1000,
      );
    };
    schedulePoll();
  },

  async connect(adapterId, options) {
    const { engine, profile } = get();
    if (!engine) return false;
    set({ busy: true, lastError: undefined });
    try {
      const adapter = await createAdapter(adapterId);
      await adapter.connect(options);
      await engine.setAdapter(adapter);
      if (profile) {
        const safe = await stashSecrets(profile.id, options);
        const updated: VaultProfile = { ...profile, adapter: adapterId, options: safe };
        saveProfile(updated);
        set({ profile: updated });
      }
      set({ busy: false });
      await engine.syncAll();
      return true;
    } catch (error) {
      set({ busy: false, lastError: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  async disconnect() {
    const { profile } = get();
    await get().engine?.setAdapter(null);
    if (profile) {
      const updated: VaultProfile = { ...profile, adapter: undefined, options: undefined };
      saveProfile(updated);
      set({ profile: updated });
    }
  },

  /** Ручная синхронизация. Направление перекрывает настройку по умолчанию. */
  async syncNow(direction) {
    set({ busy: true });
    await get().engine?.syncAll(direction ? { direction } : {});
    set({ busy: false });
  },

  notifyChange(path) {
    get().engine?.notifyLocalChange(path);
  },

  notifyDelete(path) {
    get().engine?.notifyLocalDelete(path);
  },
}));
