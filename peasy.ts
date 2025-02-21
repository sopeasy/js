declare global {
    interface Window {
        peasy: Peasy;
    }
}

export type Peasy = {
    init: () => void;
    track: (event: string, data?: Record<string, unknown>) => void;
    setProfile: (id: string, data: Record<string, unknown>) => void;
    page: () => void;
    disableTracking: () => void;
}

export type PeasyOptions = {
    websiteId: string;
    ingestUrl: string | null;
    autoPageView: boolean | null;
    maskPatterns: string[] | null;
    skipPatterns: string[] | null;
}

const VISITOR_ID_LOCALSTORAGE_KEY = 'peasy-visitor-id';
const DO_NOT_TRACK_LOCALSTORAGE_KEY = 'peasy-do-not-track';

export const Peasy = (options: PeasyOptions) => {
    const websiteId = options.websiteId;
    const ingestUrl = options.ingestUrl ?? 'https://api.peasy.so/v1/ingest/'
    const maskPatterns = options.maskPatterns ?? [];
    const autoPageView = options.autoPageView ?? true;
    const regexMaskPatterns = options.maskPatterns?.map((e) => {
        return new RegExp(`^${_normalizeUrl(e).replace(/\*/g, "[^/]+")}$`)
    }) ?? [];
    const skipPatterns = options.skipPatterns?.map((e) => {
        return new RegExp(`^${_normalizeUrl(e).replace(/\*/g, "[^/]+")}$`)
    }) ?? [];
    let lastPage: string | null = null;


    const init = () => {
        if (autoPageView) {
            _registerPageChangeListeners();
        }
        _registerCustomEventListeners();
    }

    const track = (event: string, data?: Record<string, unknown>) => {
        if (_isTrackingDisabled()) return;

        const pageUrl = _processUrl(location.href);
        if (!pageUrl) {
            return;
        }

        const payload = {
            name: event,
            website_id: websiteId,
            page_url: pageUrl,
            host_name: location.hostname,
            referrer: _getReferrer(),
            lang: navigator.language,
            screen: `${screen.width}x${screen.height}`,
            metadata: data || {},
        };

        _send("e", payload);
    }

    const setProfile = (id: string, data: Record<string, unknown>) => {
        _send("p", {
            website_id: websiteId,
            host_name: location.hostname,
            profile_id: id,
            profile: data,
        });
    };

    const page = () => {
        if (lastPage === location.pathname) return;
        lastPage = location.pathname;
        track('$page_view', { page_title: document.title });
    };

    const disableTracking = () => {
        localStorage.setItem(DO_NOT_TRACK_LOCALSTORAGE_KEY, "true")
    }

    function _processUrl(url: string) {
        let _url = new URL(url);
        let pathname = _url.pathname;

        if (skipPatterns.some((regex) => regex.test(pathname))) {
            return null;
        }

        for (let i = 0; i < regexMaskPatterns.length; i++) {
            if (regexMaskPatterns[i].test(pathname)) {
                return maskPatterns[i];
            }
        }

        _url.pathname = pathname;
        _url.search = ''
        return _url.toString();
    }

    const _getReferrer = () => {
        return !document.referrer.includes(location.hostname) ? document.referrer : '';
    };

    const _isTrackingDisabled = () => {
        return localStorage.getItem(DO_NOT_TRACK_LOCALSTORAGE_KEY) === "true"
    };

    const _normalizeUrl = (url: string) => {
        if (url.endsWith("/")) {
            return url.slice(0, -1);
        }
        return url;
    }

    const _send = (path: string, payload: Record<string, unknown>) => {
        try {
            const url = new URL(path, ingestUrl).href;
            fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Visitor-ID': localStorage.getItem(VISITOR_ID_LOCALSTORAGE_KEY) || '',
                },
                body: JSON.stringify(payload),
                keepalive: true,
            }).then(r => {
                const visitorId = r.headers.get('X-Visitor-ID');
                if (visitorId) {
                    localStorage.setItem(VISITOR_ID_LOCALSTORAGE_KEY, visitorId);
                }
            });
        } catch (e) {
            console.error('[peasy.js] Error:', e);
        }
    };

    const _registerPageChangeListeners = () => {
        history.pushState = function (...args) {
            history.pushState.apply(this, args);
            page();
        };

        addEventListener("popstate", () => page());

        if (document.visibilityState !== "visible") {
            document.addEventListener("visibilitychange", () => {
                if (!lastPage && document.visibilityState === "visible") page();
            });
        } else {
            page();
        }
    }

    const _registerCustomEventListeners = () => {
        document.addEventListener("click", (event) => {
            let targetElement = event.target as HTMLElement | null;

            if (
                !targetElement ||
                ((targetElement.tagName === "INPUT" ||
                    targetElement.tagName === "SELECT" ||
                    targetElement.tagName === "TEXTAREA") &&
                    //@ts-ignore
                    targetElement.type !== "submit")
            ) {
                return;
            }

            while (targetElement && !targetElement?.hasAttribute("data-peasy-event")) {
                targetElement = targetElement.parentElement;
            }

            if (!targetElement) return;

            const eventName = targetElement.getAttribute("data-peasy-event");
            if (!eventName) return;

            const eventData = {};

            for (const attr of Array.from(targetElement.attributes)) {
                if (attr.name.startsWith("data-peasy-event-") && attr.value) {
                    eventData[attr.name.slice("data-peasy-event-".length)] = attr.value;
                }
            }

            if (targetElement.tagName === "FORM") {
                const form = targetElement as HTMLFormElement;
                const inputs = Array.from(form.elements) as HTMLInputElement[];
                for (const input of inputs) {
                    if (input.type == "password") continue;
                    if (!input.name) continue
                    if (input.hasAttribute("data-peasy-ignore")) continue;

                    if (input.type === 'checkbox' || input.type === 'radio') {
                        eventData[input.name] = input.checked;
                        continue
                    }

                    if (input.value) {
                        eventData[input.name] = input.value;
                    }
                }
            }

            track(eventName, eventData);
        });
    }

    return {
        init,
        track,
        setProfile,
        page,
        disableTracking
    }
}

if (!window.peasy) {
    const peasy = Peasy(
        {
            websiteId: document.currentScript?.getAttribute("data-website-id")!,
            ingestUrl: document.currentScript?.getAttribute("data-ingest-url") ?? null,
            autoPageView: document.currentScript?.getAttribute("data-auto-page-view") !== "false",
            maskPatterns: document.currentScript?.getAttribute("data-mask-patterns")?.split(",") ?? null,
            skipPatterns: document.currentScript?.getAttribute("data-skip-patterns")?.split(",") ?? null,
        }
    );
    window.peasy = peasy;
}