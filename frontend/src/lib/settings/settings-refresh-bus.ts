/**
 * settings-refresh-bus — thin re-export of the shared bus from
 * ``@astrapi69/ai-key-vault``.
 *
 * The reactive settings-refresh pub/sub moved into the package (the encrypted
 * key-vault import + the AI settings panel now live there and emit on it).
 * This module stays as the app-local import path so existing consumers
 * (Settings page, BackupSection, ``useApiKeyStatus``) and their test mocks
 * keep working unchanged — and, crucially, the app's ``useApiKeyStatus``
 * subscribes to the SAME singleton the package panel emits on, so an imported
 * key still lights up the AI gates without a reload (#1836).
 */

export {
    subscribeSettingsRefresh,
    emitSettingsRefresh,
    resetSettingsRefreshBus,
} from "@astrapi69/ai-key-vault";
