export function getFetchPromise(request) {
    const headers = request.headers || {};

    if (request.dataType === 'json') {
        headers.accept = 'application/json';
    }

    const fetchRequest = {
        headers: headers,
        method: request.type,
        credentials: 'same-origin'
    };

    let contentType = request.contentType;

    if (request.data) {
        if (typeof request.data === 'string') {
            fetchRequest.body = request.data;
        } else {
            fetchRequest.body = paramsToString(request.data);

            contentType = contentType || 'application/x-www-form-urlencoded; charset=UTF-8';
        }
    }

    if (contentType) {
        headers['Content-Type'] = contentType;
    }

    let url = request.url;

    if (request.query) {
        const paramString = paramsToString(request.query);
        if (paramString) {
            url += `?${paramString}`;
        }
    }

    if (!request.timeout) {
        return fetch(url, fetchRequest);
    }

    return fetchWithTimeout(url, fetchRequest, request.timeout);
}

function fetchWithTimeout(url, options, timeoutMs) {
    console.debug(`fetchWithTimeout: timeoutMs: ${timeoutMs}, url: ${url}`);

    // Use AbortController to actually cancel the underlying HTTP request on timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(function () {
        controller.abort();
    }, timeoutMs);

        options = options || {};
        options.credentials = 'same-origin';
    options.signal = controller.signal;

    return fetch(url, options).then(function (response) {
        clearTimeout(timeoutId);
            console.debug(`fetchWithTimeout: succeeded connecting to url: ${url}`);
        return response;
    }).catch(function (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.debug(`fetchWithTimeout: timed out connecting to url: ${url}`);
            throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
}
        console.debug(`fetchWithTimeout: failed connecting to url: ${url}`);
        throw error;
    });
}

/**
     * @param params {Record<string, string | number | boolean>}
     * @returns {string} Query string
     */
function paramsToString(params) {
    return Object.entries(params)
        // eslint-disable-next-line sonarjs/different-types-comparison
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
}

export function ajax(request) {
    if (!request) {
        throw new Error('Request cannot be null');
    }

    request.headers = request.headers || {};

    console.debug(`requesting url: ${request.url}`);

    return getFetchPromise(request).then(function (response) {
        console.debug(`response status: ${response.status}, url: ${request.url}`);
        if (response.status < 400) {
            if (request.dataType === 'json' || request.headers.accept === 'application/json') {
                return response.json();
            } else if (request.dataType === 'text' || (response.headers.get('Content-Type') || '').toLowerCase().startsWith('text/')) {
                return response.text();
            } else {
                return response;
            }
        } else {
            return Promise.reject(response);
        }
    }, function (err) {
        console.error(`request failed to url: ${request.url}`);
        throw err;
    });
}

