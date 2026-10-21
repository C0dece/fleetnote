import { create } from "zustand";
import type { VaultFs } from "@/core/fs/types";
import { SyncEngine, type SyncState as EngineState } from "@/core/sync/syncEngine";
import { createAdapter } from "@/core/sync/adapters";
import type { AdapterId, StorageConfig } from "@/core/sync/types";

const CONFIG_KEY = "fleetnote.sync-config.v1";

interface SyncStoreState {
  engine: SyncEngine | null;
  config: StorageConfig;
  status: EngineState;
  busy: boolean;
  lastError?: string;

  attach(fs: VaultFs, onRemoteChange: () => Promise<void>): Promise<void>;
  connect(adapter: AdapterId, options: Record<string, string>): Promise<boolean>;
  disconnect(): Promise<void>;
  syncNow(): Promise<void>;
  notifyChange(path: string): void;
  notifyDelete(path: string): void;
}

function loadConfig(): StorageConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return JSON.parse(raw) as StorageConfig;
  } catch {
    /* повреждённый конфиг — начинаем с чистого */
  }
  return { adapter: "none", options: {} };
}

function saveConfig(config: StorageConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    /* приватный режим */
  }
}

export const useSyncStore = create<SyncStoreState>((set, get) => ({
  engine: null,
  config: loadConfig(),
  status: { status: "off", pending: 0, conflicts: [] },
  busy: false,

  async attach(fs, onRemoteChange) {
    get().engine?.dispose();
    const engine = new SyncEngine(fs);
    engine.onState((status) => set({ status }));
    set({ engine });

    const { config } = get();
    if (config.adapter !== "none") {
      try {
        const adapter = await createAdapter(config.adapter);
        await adapter.connect(config.options);
        await engine.setAdapter(adapter);
        const report = await engine.syncAll();
        if (report && (report.pulled.length || report.merged.length || report.conflicted.length)) {
          await onRemoteChange();
        }
      } catch (error) {
        set({ lastError: error instanceof Error ? error.message : String(error) });
      }
    }
    // Периодическая сверка: ловит правки, сделанные на других устройствах.
    const timer = setInterval(
      () => {
        void (async () => {
          const report = await get().engine?.syncAll();
          if (report && (report.pulled.length || report.merged.length)) await onRemoteChange();
        })();
      },
      5 * 60 * 1000,
    );
    if (typeof window !== "undefined") window.addEventListener("beforeunload", () => clearInterval(timer));
  },

  async connect(adapterId, options) {
    const { engine } = get();
    if (!engine) return false;
    set({ busy: true, lastError: undefined });
    try {
      const adapter = await createAdapter(adapterId);
      await adapter.connect(options);
      await engine.setAdapter(adapter);
      const config: StorageConfig = { adapter: adapterId, options };
      saveConfig(config);
      set({ config, busy: false });
      await engine.syncAll();
      return true;
    } catch (error) {
      set({ busy: false, lastError: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  async disconnect() {
    const config: StorageConfig = { adapter: "none", options: {} };
    saveConfig(config);
    await get().engine?.setAdapter(null);
    set({ config });
  },

  async syncNow() {
    set({ busy: true });
    await get().engine?.syncAll();
    set({ busy: false });
  },

  notifyChange(path) {
    get().engine?.notifyLocalChange(path);
  },

  notifyDelete(path) {
    get().engine?.notifyLocalDelete(path);
  },
}));
