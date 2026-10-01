import { isSelectableIndustry, type IndustryId } from "@/lib/module-registry";
export const INDUSTRY_STORAGE_KEY = "workbench.industry.v1";
type StorageAccess = Pick<Storage, "getItem" | "setItem">;
export function readIndustry(storage: StorageAccess): IndustryId | null {
  try { const value = storage.getItem(INDUSTRY_STORAGE_KEY); return isSelectableIndustry(value) ? value : null; } catch { return null; }
}
/** No browser access at module initialization or during server rendering. */
export function createIndustryPreference(getStorage: () => StorageAccess) {
  let selected: IndustryId | null = null;
  let loaded = false;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  return {
    getSnapshot: () => selected,
    getServerSnapshot: (): IndustryId | null => null,
    restore() { try { selected = readIndustry(getStorage()); } catch { selected = null; } loaded = true; notify(); },
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!loaded) { try { selected = readIndustry(getStorage()); } catch { selected = null; } loaded = true; }
      return () => { listeners.delete(listener); };
    },
    select(value: IndustryId) {
      if (!isSelectableIndustry(value)) return;
      selected = value; loaded = true;
      try { getStorage().setItem(INDUSTRY_STORAGE_KEY, value); } catch { /* Keep this session usable when browser storage is blocked. */ }
      notify();
    },
  };
}
export const industryPreference = createIndustryPreference(() => window.localStorage);
