import {useNavigate} from "react-router-dom";

import {Button} from "@/components/ui/button";
import {useI18n} from "../hooks/useI18n";

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
            style={{
                minHeight: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "2rem",
                gap: "1rem",
                textAlign: "center",
            }}
        >
            <h1 style={{margin: 0}}>404</h1>
            <p style={{margin: 0, opacity: 0.7}}>
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
