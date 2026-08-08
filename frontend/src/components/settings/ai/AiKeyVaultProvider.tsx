/**
 * AiKeyVaultProvider — the adaptive-learner wiring of
 * ``@astrapi69/ai-key-vault-react``'s ``AiSettingsProvider``. Assembles the
 * app-specific dependencies once (storage adapter, localized provider
 * registry, i18n, toast, confirm dialog, router link, shadcn UI slots, the
 * live-discovery ModelPicker) and wraps the tree, so the package's settings
 * UI and the ``useApiKeyStatus`` gate work everywhere.
 *
 * Mounted at the app root (App.tsx), above the feature-strategy context that
 * reads ``useApiKeyStatus``.
 */

import { useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { Bot, Gem, Sparkles } from "lucide-react";
import {
    BUILTIN_PROVIDERS,
    createProviderRegistry,
} from "@astrapi69/ai-key-vault";
import {
    AiSettingsProvider,
    type ButtonSlot,
    type InputSlot,
    type LinkSlot,
    type ModelPickerSlot,
    type ProviderIcon,
} from "@astrapi69/ai-key-vault-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "../../../hooks/ui/useI18n";
import { useConfirm } from "../../../contexts/ConfirmContext";
import { notify } from "../../../utils/notify";
import { readLearnerState } from "../../../lib/learning/learnerState";
import { resolveStorageMode } from "../../../storage";
import { AI_PROVIDERS, MODEL_SUGGESTIONS, type AIProvider } from "../../../lib/constants";
import { createSettingsKeyStoreAdapter } from "../../../lib/keys/ai-key-store-adapter";
import { ModelPicker } from "./ModelPicker";

const PROVIDER_ICONS: Partial<Record<AIProvider, ProviderIcon>> = {
    anthropic: Sparkles,
    openai: Bot,
    gemini: Gem,
};

// Port keys from sibling apps: Topos (and other @astrapi69 hosts) call the
// Google provider "google"; this app calls it "gemini". Combined with the
// kit's format-agnostic import, a Topos .alk (format "topos-ai-keys", key
// under "google") imports here and lands on "gemini".
const IMPORT_PROVIDER_ALIASES = { google: "gemini" } as const;

const ButtonSlotImpl: ButtonSlot = ({ variant, size, ...rest }) => (
    <Button variant={variant} size={size} {...rest} />
);

const InputSlotImpl = Input as unknown as InputSlot;

const LinkSlotImpl: LinkSlot = ({ to, children, ...rest }) => (
    <Link to={to} {...rest}>
        {children}
    </Link>
);

// The live-discovery ModelPicker takes an extra ``staticSuggestions`` prop the
// package slot does not pass; inject it per provider here.
const ModelPickerSlotImpl: ModelPickerSlot<AIProvider> = (props) => (
    <ModelPicker {...props} staticSuggestions={MODEL_SUGGESTIONS[props.provider]} />
);

export function AiKeyVaultProvider({ children }: { children: ReactNode }) {
    const { t } = useI18n();
    const confirm = useConfirm();
    const userId = readLearnerState().userId;

    const adapter = useMemo(() => createSettingsKeyStoreAdapter(), []);
    const registry = useMemo(
        () =>
            createProviderRegistry(
                BUILTIN_PROVIDERS.filter((d) => AI_PROVIDERS.includes(d.id as AIProvider)).map(
                    (d) => ({ ...d, label: t(`settings.provider_${d.id}`, d.label) }),
                ),
            ),
        [t],
    );

    return (
        <AiSettingsProvider<AIProvider>
            adapter={adapter}
            registry={registry}
            userId={userId}
            t={t}
            notify={notify}
            confirm={confirm}
            vaultFormat="adaptive-learner-keys"
            importProviderAliases={IMPORT_PROVIDER_ALIASES}
            browserRuntime={resolveStorageMode() === "dexie"}
            Button={ButtonSlotImpl}
            Input={InputSlotImpl}
            Link={LinkSlotImpl}
            providerIcons={PROVIDER_ICONS}
            ModelPicker={ModelPickerSlotImpl}
        >
            {children}
        </AiSettingsProvider>
    );
}
