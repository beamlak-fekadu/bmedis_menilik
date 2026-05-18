# BMEDIS Lottie animation assets

Drop `.lottie` files in this directory. The UI references them by these exact
filenames; if a file is missing, `LottiePlayer` falls back to a lucide icon or
the caller-supplied fallback — nothing crashes, but the animation won't play.

| Filename            | Used by                                  | Suggested feel                          |
| ------------------- | ---------------------------------------- | --------------------------------------- |
| `empty-state.lottie`| `EmptyState` (default empty visual)      | Calm, low-loop, neutral palette.        |
| `offline.lottie`    | Offline indicator, /offline page         | Subtle "no connection" pulse.           |
| `success.lottie`    | Telegram test success, completion toasts | Quick green check; short, non-looping.  |
| `notification.lottie`| /notifications empty state              | Subtle bell.                            |
| `ai-thinking.lottie`| `LoadingState`, AI Copilot thinking      | Soft particles / dots, infinite loop.   |
| `scan.lottie`       | QR scan loading                          | Scanning line pulse.                    |

Use the `@lottiefiles/dotlottie-react` `.lottie` bundle format (NOT the older
`.json` Bodymovin format) — `LottiePlayer` imports `dotlottie-react`.

No animation URLs are fetched at runtime — only files in `/public/lottie/`.
This is intentional so the app stays self-contained and works offline.
