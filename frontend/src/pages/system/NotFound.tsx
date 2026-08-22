import {useNavigate} from "react-router";

import {Button} from "@/components/ui/button";
import {useI18n} from "../../hooks/ui/useI18n";

/**
 * 404 fallback for unmatched routes. Keeps a single link back to
 * Landing so a typo'd URL never strands the user.
 */
export default function NotFound() {
    const {t} = useI18n();
    const navigate = useNavigate();
    return (
        <main
            id="main"
            data-testid="not-found"
            className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center"
        >
            <h1 className="m-0">404</h1>
            <p className="m-0 opacity-70">
                {t("errors.not_found", "Not found.")}
            </p>
            <Button
                type="button"
                variant="default"
                data-testid="not-found-home"
                onClick={() => navigate("/")}
            >
                {t("nav.home", "Home")}
            </Button>
        </main>
    );
}
