
// 换成需要反代的doh域名
const upstream = 'dns.google'

// Custom pathname for the upstream website.
const upstream_path = '/'

// Countries and regions where you wish to suspend your service.
const blocked_region = ['KP', 'SY', 'PK', 'CU']

// IP addresses which you wish to block from using your service.
const blocked_ip_address = ['0.0.0.0', '127.0.0.1']

// Whether to use HTTPS protocol for upstream address.
const https = true

// Whether to disable cache.
const disable_cache = true

// 改成你自己的密码，如密码是test123456，则请求时使用https://域名/test123456/dns-query
const security_key = 'test123456'

// Replace texts.
const replace_dict = {
}

addEventListener('fetch', event => {
    event.respondWith(fetchAndApply(event.request));
})

async function fetchAndApply(request) {
    const region = request.headers.get('cf-ipcountry').toUpperCase();
    const ip_address = request.headers.get('cf-connecting-ip');
    const user_agent = request.headers.get('user-agent');

    let response = null;
    let url = new URL(request.url);
    let url_hostname = url.hostname;
    let upstream_domain = upstream;
    if (https == true) {
        url.protocol = 'https:';
    } else {
        url.protocol = 'http:';
    }
    var spilt_url = url.pathname.split('/');
    var security = spilt_url[1];
    url.host = upstream_domain;
    if (url.pathname == '/') {
        url.pathname = upstream_path;
    } else {
        url.pathname = upstream_path + url.pathname;
    }
    console.log(JSON.stringify(request));
    console.log(url.pathname);
    console.log(upstream_domain);
    if (blocked_region.includes(region)) {
        response = new Response('Internal Server Error', {
            status: 500
        });
    } else if (blocked_ip_address.includes(ip_address)) {
        response = new Response('Internal Server Error', {
            status: 500
        });
    } else if (security != security_key) {
        //reject if key mismatch
        response = new Response('Internal Server Error', {
            status: 500
        });
    } else {
        let method = request.method;
        let request_headers = request.headers;
        let new_request_headers = new Headers(request_headers);
        
        //恢复原来的path
        url.href = url.href.replace("/"+security_key, "");
        console.log(url.href);

        new_request_headers.set('Host', upstream_domain);
        new_request_headers.set('Referer', url.protocol + '//' + url_hostname);
        
        let original_response = await fetch(decodeURIComponent(url.href), {
            method: method,
            headers: new_request_headers,
            body: request.body
        })

        connection_upgrade = new_request_headers.get("Upgrade");
        if (connection_upgrade && connection_upgrade.toLowerCase() == "websocket") {
            return original_response;
        }

        let original_response_clone = original_response.clone();
        let original_text = null;
        let response_headers = original_response.headers;
        let new_response_headers = new Headers(response_headers);
        let status = original_response.status;
		
        if (disable_cache) {
            new_response_headers.set('Cache-Control', 'no-store');
        }

        new_response_headers.set('access-control-allow-origin', '*');
        new_response_headers.set('access-control-allow-credentials', true);
        new_response_headers.delete('content-security-policy');
        new_response_headers.delete('content-security-policy-report-only');
        new_response_headers.delete('clear-site-data');
		
        if (new_response_headers.get("x-pjax-url")) {
            new_response_headers.set("x-pjax-url", response_headers.get("x-pjax-url").replace("//" + upstream_domain, "//" + url_hostname));
        }
		
        const content_type = new_response_headers.get('content-type');
        //if (content_type != null && content_type.includes('text/html') && content_type.includes('UTF-8')) {
        //    original_text = await replace_response_text(original_response_clone, upstream_domain, url_hostname);
        //} else {
            original_text = original_response_clone.body
        //}
		
        response = new Response(original_text, {
            status,
            headers: new_response_headers
        })
    }
    return response;
}

async function replace_response_text(response, upstream_domain, host_name) {
    let text = await response.text()

    var i, j;
    for (i in replace_dict) {
        j = replace_dict[i]
        if (i == '$upstream') {
            i = upstream_domain
        } else if (i == '$custom_domain') {
            i = host_name
        }

        if (j == '$upstream') {
            j = upstream_domain
        } else if (j == '$custom_domain') {
            j = host_name
        }

        let re = new RegExp(i, 'g')
        text = text.replace(re, j);
    }
    return text;
}
