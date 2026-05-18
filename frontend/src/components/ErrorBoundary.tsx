import {Component, type ErrorInfo, type ReactNode} from "react";

interface ErrorBoundaryProps {
    children: ReactNode;
    /** Optional override for the fallback render. */
    fallback?: (error: Error) => ReactNode;
}

interface ErrorBoundaryState {
    error: Error | null;
}

/**
 * Class-based React error boundary. Catches anything thrown
 * during render / lifecycle / commit and shows a static fallback
 * so a single component bug never blanks the whole app.
 *
 * Error boundaries DO NOT catch:
 *   - Errors inside event handlers (those are caught by the
 *     async try/catch + notify.error pattern in each page)
 *   - Errors in async code (same — caller catches)
 *   - Errors during server-side rendering
 *
 * The fallback is intentionally minimal: in v0.1.0 a reload is
 * the fastest recovery; the boundary surfaces the error string
 * + a reload button.
 */
export default class ErrorBoundary extends Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    state: ErrorBoundaryState = {error: null};

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return {error};
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        // Log so the browser console retains a stacktrace for
        // any "Report issue" / debug session. The console.error
        // is the one place we don't go through the toast helper
        // because the toast container is INSIDE the boundary's
        // children and may itself have failed.
        // eslint-disable-next-line no-console
        console.error("ErrorBoundary caught:", error, info.componentStack);
    }

    handleReload = (): void => {
        if (typeof window !== "undefined") {
            window.location.reload();
        }
    };

    render(): ReactNode {
        const {error} = this.state;
        if (error) {
            if (this.props.fallback) return this.props.fallback(error);
            return (
                <main
                    data-testid="error-boundary"
                    style={{
                        minHeight: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "1rem",
                        padding: "2rem",
                        textAlign: "center",
                    }}
                >
                    <h1 style={{margin: 0}}>Something broke.</h1>
                    <p style={{margin: 0, opacity: 0.7, maxWidth: "32rem"}}>
                        {error.message}
                    </p>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={this.handleReload}
                    >
                        Reload
                    </button>
                </main>
            );
        }
        return this.props.children;
    }
}
