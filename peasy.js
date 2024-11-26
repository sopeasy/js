((window) => {
    if (!window.document.currentScript) return;

    const INGEST_EVENT_PATH = "e";

    config = {
        websiteId: '',
        ingestUrl: 'https://api.peasy.so/v1/ingest/',
        maskPatterns: [],
        autoPageView: true,
        ignoreQueryParams: false
    }

    const attr = window.document.currentScript.getAttribute.bind(document.currentScript);

    config.websiteId = attr('data-website-id');
    if (!config.websiteId) {
        console.error(`[peasy.js] Error: website-id is required`);
        return;
    }

    const ingestUrl = attr('data-ingest-url');
    if (ingestUrl) {
        try {
            new URL(ingestUrl);
            config.ingestUrl = ingestUrl;
        } catch (e) {
            console.error(`[peasy.js] Error: ingest-url is invalid`);
            console.warn(`[peasy.js] Warn: ingest-url is invalid, using default`);
        }
    }

    const maskPatterns = JSON.parse(attr('data-mask-patterns'));
    if (maskPatterns) {
        try {
            const maskPatternsArr = JSON.parse(maskPatterns);
            if (!Array.isArray(maskPatternsArr)) {
                throw new Error("Invalid mask patterns");
            }
            config.maskPatterns = maskPatterns;
        } catch (e) {
            console.warn(`[peasy.js] Warn: mask-patterns are invalid, ignoring`);
        }
    }

    config.autoPageView = attr('data-auto-page-view') !== "false";
    config.ignoreQueryParams = attr('data-ignore-query-params') === "true";

    const send = (path, payload) => {
        const url = new URL(path, config.ingestUrl).href;
        try {
            if (!navigator?.sendBeacon(url, JSON.stringify(payload))) {
                fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    keepalive: true,
                });
            }
        } catch (e) {
            console.error(`[peasy.js] Error: ${e.message}`);
        }
    };

    const processUrl = (url) => {
        let _url = new URL(url);
        if (config.maskPatterns.length > 0) {
            for (const mask of config.maskPatterns) {
                const maskedPathname = maskPathname(mask, _url.pathname);
                if (maskedPathname !== _url.pathname) {
                    _url.pathname = maskedPathname;
                    break;
                }
            }
        }
        if (config.ignoreQueryParams) {
            _url.search = "";
        }
        return _url.href;
    };

    const getReferrer = () => {
        return !window.document.referrer.includes(location.hostname) ? window.document.referrer : "";
    }

    const maskPathname = (maskPattern, pathname) => {
        const maskSegments = (() => {
            if (maskPattern.endsWith('/')) {
                return url.slice(0, -1);
            }
            return maskPattern;
        })().split('/');

        const pathSegments = (() => {
            if (pathname.endsWith('/')) {
                return url.slice(0, -1);
            }
            return pathname;
        })().split('/');


        if (pathSegments.length > maskSegments.length) {
            return pathname;
        }

        const maskedSegments = [];

        for (let i = 0; i < maskSegments.length; i++) {
            const maskSegment = maskSegments[i];

            if (maskSegment === '*') {
                maskedSegments.push('*');
            } else {
                if (pathSegments[i] !== undefined) {
                    maskedSegments.push(pathSegments[i]);
                } else {
                    maskedSegments.push('');
                }
            }
        }

        const maskedPath = maskedSegments.join('/');
        return maskedPath;
    };

    const registerPushListener = () => {
        const hook = (_this, method, callback) => {
            const orig = _this[method];
            return (...args) => {
                callback.apply(null, args);
                return orig.apply(_this, args);
            };
        };
        const handlePush = (_, title, url) => {
            if (!url) return;

            const urlBeforePush = window.location.href;
            const urlAfterPush = url.toString();

            if (urlBeforePush !== urlAfterPush) {
                const payload = {
                    website_id: config.websiteId,
                    name: "$page_view",
                    referrer: getReferrer(),
                    page_url: processUrl(urlAfterPush),
                    host_name: window.location.hostname,
                    lang: window.navigator.language,
                    screen: `${screen.width}x${screen.height}`,
                    metadata: { title }
                }
                const t = setTimeout(() => {
                    send(INGEST_EVENT_PATH, payload);
                    clearTimeout(t)
                }, 100)
            }
        };

        window.history.pushState = hook(window.history, 'pushState', handlePush);
        window.history.replaceState = hook(window.history, 'replaceState', handlePush);
    };

    const track = async (name, metadata) => {
        const payload = {
            website_id: config.websiteId,
            name,
            referrer: getReferrer(),
            page_url: processUrl(window.location.href),
            host_name: window.location.hostname,
            lang: window.navigator.language,
            screen: `${screen.width}x${screen.height}`,
            metadata,
        }
        send(INGEST_EVENT_PATH, payload);
    }

    const page = () => track("$page_view");

    page();
    registerPushListener();

    window.peasy = {
        track,
        page
    }
})(window)




