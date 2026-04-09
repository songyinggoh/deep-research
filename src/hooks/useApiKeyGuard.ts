import { useGlobalStore } from "@/store/global";
import { useSettingStore } from "@/store/setting";
import useAiProvider from "@/hooks/useAiProvider";

/**
 * Returns a `checkApiKey` function that can be called inside submit handlers.
 * If the user is in local mode without a configured API key, `checkApiKey`
 * opens the Settings modal and returns `false`.  Otherwise it returns `true`
 * and the caller should proceed with the AI call.
 */
export function useApiKeyGuard(): () => boolean {
  const { hasApiKey } = useAiProvider();

  function checkApiKey(): boolean {
    const { mode } = useSettingStore.getState();
    if ((mode === "local" && hasApiKey()) || mode === "proxy") {
      return true;
    }
    useGlobalStore.getState().setOpenSetting(true);
    return false;
  }

  return checkApiKey;
}
