// Interceptor for network requests and console errors

(function () {
    // Network interception
    const XHR = XMLHttpRequest.prototype;
    const open = XHR.open;
    const send = XHR.send;

    XHR.open = function (method, url) {
        this._method = method;
        this._url = url;
        return open.apply(this, arguments);
    };

    XHR.send = function (postData) {
        this.addEventListener('load', function () {
            window.postMessage({
                type: 'NETWORK_REQUEST',
                payload: {
                    type: 'xhr',
                    method: this._method,
                    url: this._url,
                    status: this.status,
                    response: this.response
                }
            }, '*');
        });
        return send.apply(this, arguments);
    };

    // Fetch interception
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await originalFetch(...args);
        const clone = response.clone();

        let url = args[0];
        let options = args[1] || {};
        let method = options.method || 'GET';

        // Handle Request object if passed as first argument
        if (typeof url === 'object' && url instanceof Request) {
            method = url.method;
            url = url.url;
        }

        clone.text().then(body => {
            window.postMessage({
                type: 'NETWORK_REQUEST',
                payload: {
                    type: 'fetch',
                    method: method,
                    url: url.toString(), // Ensure string
                    status: response.status,
                    response: body
                }
            }, '*');
        }).catch(err => {
            // Ignore body read errors
        });

        return response;
    };

    // Console error interception
    const originalConsoleError = console.error;
    console.error = function (...args) {
        window.postMessage({
            type: 'CONSOLE_ERROR',
            payload: {
                message: args.map(a => String(a)).join(' '),
                timestamp: Date.now()
            }
        }, '*');
        originalConsoleError.apply(console, args);
    };
})();
