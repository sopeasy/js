((window) => {
    if (!window.document.currentScript) return;

    const POST_EVENT_PATH = 'e';
    const POST_PROFILE_PATH = 'p';
    const VISITOR_ID_LOCALSTORAGE_KEY = 'peasy-visitor-id';

    const config = {
        websiteId: '',
        ingestUrl: 'https://api.peasy.so/v1/ingest/',
        maskPatterns: [],
        autoPageView: true,
        ignoreQueryParams: false
    };

    const attr = window.document.currentScript.getAttribute.bind(window.document.currentScript);

    config.ingestUrl = attr('data-ingest-url') || config.ingestUrl;
    if (!config.ingestUrl.endsWith('/')) {
        config.ingestUrl += '/';
    }

    config.websiteId = attr('data-website-id');
    config.maskPatterns = JSON.parse(attr('data-mask-patterns') || '[]');
    config.autoPageView = attr('data-auto-page-view') !== "false";
    config.ignoreQueryParams = attr('data-ignore-query-params') === "true";

    if (!config.websiteId) {
        console.warn('[peasy.js] Website ID not provided');
        return;
    }

    let lastPage = null;

    const maskPathname = (maskPattern, pathname) => {
        const normalizePath = (path) =>
            path.endsWith('/') ? path.slice(0, -1).split('/') : path.split('/');

        const maskSegments = normalizePath(maskPattern);
        const pathSegments = normalizePath(pathname);

        if (pathSegments.length > maskSegments.length) return pathname;

        const maskedSegments = [];
        for (let i = 0; i < maskSegments.length; i++) {
            const maskSegment = maskSegments[i];
            const pathSegment = pathSegments[i];

            if (maskSegment === '*') {
                maskedSegments.push('*');
            } else if (pathSegment && maskSegment === pathSegment) {
                maskedSegments.push(pathSegment);
            } else {
                return pathname;
            }
        }
        return maskedSegments.join('/');
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
        if (config.ignoreQueryParams) _url.search = '';
        return _url.href;
    };

    const getReferrer = () => {
        return !document.referrer.includes(location.hostname) ? document.referrer : '';
    };

    const send = (path, payload) => {
        try {
            const url = new URL(path, config.ingestUrl).href;
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

    const track = (name, metadata) => {
        const payload = {
            name,
            website_id: config.websiteId,
            page_url: processUrl(location.href),
            host_name: location.hostname,
            referrer: getReferrer(),
            lang: navigator.language,
            screen: `${screen.width}x${screen.height}`,
            metadata: metadata || {},
        };
        send(POST_EVENT_PATH, payload);
    };

    const setProfile = (profileId, profile) => {
        send(POST_PROFILE_PATH, {
            website_id: config.websiteId,
            host_name: location.hostname,
            profile_id: profileId,
            profile: profile,
        });
    };

    const page = () => {
        if (lastPage === location.pathname) return;
        lastPage = location.pathname;
        track('$page_view', { page_title: document.title });
    };

    if (config.autoPageView) {
        page();

        const hook = (history, method, callback) => {
            const orig = history[method];
            return (...args) => {
                callback(...args);
                return orig.apply(history, args);
            };
        };

        const handlePush = (state, title, url) => {
            if (!url) return;
            const currentUrl = location.href;
            const newUrl = url.toString();
            if (currentUrl !== newUrl) setTimeout(page, 100);
        };

        history.pushState = hook(history, 'pushState', handlePush);
        history.replaceState = hook(history, 'replaceState', handlePush);
    }

    window.peasy = {
        track,
        page,
        setProfile,
    };
})(window);