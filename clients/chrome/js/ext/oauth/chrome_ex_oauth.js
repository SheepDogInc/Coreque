/**
 * Copyright (c) 2010 The Chromium Authors. All rights reserved.  Use of this
 * source code is governed by a BSD-style license that can be found in the
 * LICENSE file.
 */

/**
 * Constructor - no need to invoke directly, call initBackgroundPage instead.
 * @constructor
 * @param {String} url_auth_token The OAuth authorize token URL.
 * @param {String} url_access_token The OAuth access token URL.
 * @param {String} consumer_key The OAuth consumer key.
 * @param {String} consumer_secret The OAuth consumer secret.
 * @param {String} oauth_scope The OAuth scope parameter.
 * @param {Object} opt_args Optional arguments.  Recognized parameters:
 *     "app_name" {String} Name of the current application
 *     "callback_page" {String} If you renamed chrome_ex_oauth.html, the name
 *          this file was renamed to.
 */

function ChromeExOAuth(url_auth_token, url_access_token, consumer_key, consumer_secret, oauth_scope, opt_args) {
    this.url_auth_token = url_auth_token;
    this.url_access_token = url_access_token;
    this.consumer_key = consumer_key;
    this.consumer_secret = consumer_secret;
    this.oauth_scope = oauth_scope;
    this.callback_page = "/lib/oauth/chrome_ex_oauth.html";
    this.auth_params = {};
    this.key_token = 'access_token';
    this.initOAuthFlowCallback = function(){};
    if (opt_args && opt_args['auth_params']) {
        for (key in opt_args['auth_params']) {
            if (opt_args['auth_params'].hasOwnProperty(key)) {
                this.auth_params[key] = opt_args['auth_params'][key];
            }
        }
    }
};

/*******************************************************************************
 * PUBLIC API METHODS
 * Call these from your background page.
 ******************************************************************************/

/**
 * Initializes the OAuth helper from the background page.  You must call this
 * before attempting to make any OAuth calls.
 * @param {Object} oauth_config Configuration parameters in a JavaScript object.
 *     The following parameters are recognized:
 *         "request_url" {String} OAuth request token URL.
 *         "authorize_url" {String} OAuth authorize token URL.
 *         "access_url" {String} OAuth access token URL.
 *         "consumer_key" {String} OAuth consumer key.
 *         "consumer_secret" {String} OAuth consumer secret.
 *         "scope" {String} OAuth access scope.
 *         "app_name" {String} Application name.
 *         "auth_params" {Object} Additional parameters to pass to the
 *             Authorization token URL.  For an example, 'hd', 'hl', 'btmpl':
 *             http://code.google.com/apis/accounts/docs/OAuth_ref.html#GetAuth
 * @return {ChromeExOAuth} An initialized ChromeExOAuth object.
 */
ChromeExOAuth.initBackgroundPage = function(oauth_config) {
    window.chromeExOAuthConfig = oauth_config;
    window.chromeExOAuth = ChromeExOAuth.fromConfig(oauth_config);
    window.chromeExOAuthRedirectStarted = false;
    window.chromeExOAuthRequestingAccess = false;

    var url_match = chrome.extension.getURL(window.chromeExOAuth.callback_page);
    var tabs = {};
    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
        // Check to seee if the tab contains the code= url param and continue movin' along.
        if (tab.url.indexOf('code=') > -1 && tab.url.indexOf('coreque') > -1) {
          var code = tab.url.substr(tab.url.indexOf('code=') + 5, tab.url.length);
          
          window.chromeExOAuth.onCodeReceived(code);   
          
          chrome.tabs.remove(tab.id);
        }
    });

    return window.chromeExOAuth;
};

/**
 * Authorizes the current user with the configued API.  You must call this
 * before calling sendSignedRequest.
 * @param {Function} callback A function to call once an access token has
 *     been obtained.  This callback will be passed the following arguments:
 *         token {String} The OAuth access token.
 *         secret {String} The OAuth access token secret.
 */
ChromeExOAuth.prototype.authorize = function(callback) {
    
    var redirect_page = chrome.extension.getURL(this.callback_page)
    
    if (this.hasToken()) {
        callback(this.getToken());
    } else {
        window.chromeExOAuthOnAuthorize = function(token) {
            callback(token);
        };
        chrome.tabs.create({
            'url': redirect_page
        });
        
    }
};

/**
 * Clears any OAuth tokens stored for this configuration.  Effectively a
 * "logout" of the configured OAuth API.
 */
ChromeExOAuth.prototype.clearTokens = function() {
    delete localStorage[this.key_token + encodeURI(this.oauth_scope)];
};

/**
 * Returns whether a token is currently stored for this configuration.
 * Effectively a check to see whether the current user is "logged in" to
 * the configured OAuth API.
 * @return {Boolean} True if an access token exists.
 */
ChromeExOAuth.prototype.hasToken = function() {
    return !!this.getToken();
};

/**
 * Makes an OAuth-signed HTTP request with the currently authorized tokens.
 * @param {String} url The URL to send the request to.  Querystring parameters
 *     should be omitted.
 * @param {Function} callback A function to be called once the request is
 *     completed.  This callback will be passed the following arguments:
 *         responseText {String} The text response.
 *         xhr {XMLHttpRequest} The XMLHttpRequest object which was used to
 *             send the request.  Useful if you need to check response status
 *             code, etc.
 * @param {Object} opt_params Additional parameters to configure the request.
 *     The following parameters are accepted:
 *         "method" {String} The HTTP method to use.  Defaults to "GET".
 *         "body" {String} A request body to send.  Defaults to null.
 *         "parameters" {Object} Query parameters to include in the request.
 *         "headers" {Object} Additional headers to include in the request.
 */
ChromeExOAuth.prototype.sendSignedRequest = function(url, callback, opt_params) {
    var method = opt_params && opt_params['method'] || 'GET';
    var body = opt_params && opt_params['body'] || null;
    var params = opt_params && opt_params['parameters'] || {};
    var headers = opt_params && opt_params['headers'] || {};

    var signedUrl = this.signURL(url, method, params);

    ChromeExOAuth.sendRequest(method, signedUrl, headers, body, function(xhr) {
        if (xhr.readyState == 4) {
            callback(xhr.responseText, xhr);
        }
    });
};

/**
 * Adds the required OAuth parameters to the given url and returns the
 * result.  Useful if you need a signed url but don't want to make an XHR
 * request.
 * @param {String} method The http method to use.
 * @param {String} url The base url of the resource you are querying.
 * @param {Object} opt_params Query parameters to include in the request.
 * @return {String} The base url plus any query params plus any OAuth params.
 */
ChromeExOAuth.prototype.signURL = function(url, method, opt_params) {
    var token = this.getToken();

    if (!token) {
        throw new Error("No oauth token");
    }

    var params = opt_params || {};
    params["access_token"] = token;
    
    var result = OAuth2Simple().sign({
        action: method,
        path: url,
        parameters: params
    });

    return result.signed_url;
};

/*******************************************************************************
 * PRIVATE API METHODS
 * Used by the library.  There should be no need to call these methods directly.
 ******************************************************************************/

/**
 * Creates a new ChromeExOAuth object from the supplied configuration object.
 * @param {Object} oauth_config Configuration parameters in a JavaScript object.
 *     The following parameters are recognized:
 *         "request_url" {String} OAuth request token URL.
 *         "authorize_url" {String} OAuth authorize token URL.
 *         "access_url" {String} OAuth access token URL.
 *         "consumer_key" {String} OAuth consumer key.
 *         "consumer_secret" {String} OAuth consumer secret.
 *         "scope" {String} OAuth access scope.
 *         "app_name" {String} Application name.
 *         "auth_params" {Object} Additional parameters to pass to the
 *             Authorization token URL.  For an example, 'hd', 'hl', 'btmpl':
 *             http://code.google.com/apis/accounts/docs/OAuth_ref.html#GetAuth
 * @return {ChromeExOAuth} An initialized ChromeExOAuth object.
 */
ChromeExOAuth.fromConfig = function(oauth_config) {
    return new ChromeExOAuth(
    oauth_config['authorize_url'], oauth_config['access_url'], oauth_config['consumer_key'], oauth_config['consumer_secret'], oauth_config['scope'], {
        'app_name': oauth_config['app_name'],
        'auth_params': oauth_config['auth_params']
    });
};

/**
 * Initializes chrome_ex_oauth.html and redirects the page if needed to start
 * the OAuth flow.  Once an access token is obtained, this function closes
 * chrome_ex_oauth.html.
 */
ChromeExOAuth.initCallbackPage = function() {
    var background_page = chrome.extension.getBackgroundPage();
    var oauth_config = background_page.chromeExOAuthConfig;
    var oauth = ChromeExOAuth.fromConfig(oauth_config);
    
    background_page.chromeExOAuthRedirectStarted = true;
    
    oauth.initOAuthFlow(function(token) {
        background_page.chromeExOAuthOnAuthorize(token);
        background_page.chromeExOAuthRedirectStarted = false;
        chrome.tabs.getSelected(null, function(tab) {
            chrome.tabs.remove(tab.id);
        });
    });
};

/**
 * Sends an HTTP request.  Convenience wrapper for XMLHttpRequest calls.
 * @param {String} method The HTTP method to use.
 * @param {String} url The URL to send the request to.
 * @param {Object} headers Optional request headers in key/value format.
 * @param {String} body Optional body content.
 * @param {Function} callback Function to call when the XMLHttpRequest's
 *     ready state changes.  See documentation for XMLHttpRequest's
 *     onreadystatechange handler for more information.
 */
ChromeExOAuth.sendRequest = function(method, url, headers, body, callback) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(data) {
        callback(xhr, data);
    }
    xhr.open(method, url, true);
    if (headers) {
        for (var header in headers) {
            if (headers.hasOwnProperty(header)) {
                xhr.setRequestHeader(header, headers[header]);
            }
        }
    }
    xhr.send(body);
};

ChromeExOAuth.formDecode = function(encoded) {
    var params = encoded.split("&");
    var decoded = {};
    for (var i = 0, param; param = params[i]; i++) {
        var keyval = param.split("=");
        if (keyval.length == 2) {
            var key = ChromeExOAuth.fromRfc3986(keyval[0]);
            var val = ChromeExOAuth.fromRfc3986(keyval[1]);
            decoded[key] = val;
        }
    }
    return decoded;
};

ChromeExOAuth.getQueryStringParams = function() {
    var urlparts = window.location.href.split("?");
    if (urlparts.length >= 2) {
        var querystring = urlparts.slice(1).join("?");
        return ChromeExOAuth.formDecode(querystring);
    }
    return {};
};

ChromeExOAuth.bind = function(func, obj) {
    var newargs = Array.prototype.slice.call(arguments).slice(2);
    return function() {
        var combinedargs = newargs.concat(Array.prototype.slice.call(arguments));
        func.apply(obj, combinedargs);
    };
};

ChromeExOAuth.toRfc3986 = function(val) {
    return encodeURIComponent(val).replace(/\!/g, "%21").replace(/\*/g, "%2A").replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29");
};

ChromeExOAuth.fromRfc3986 = function(val) {
    var tmp = val.replace(/%21/g, "!").replace(/%2A/g, "*").replace(/%27/g, "'").replace(/%28/g, "(").replace(/%29/g, ")");
    return decodeURIComponent(tmp);
};

ChromeExOAuth.addURLParam = function(url, key, value) {
    var sep = (url.indexOf('?') >= 0) ? "&" : "?";
    return url + sep + ChromeExOAuth.toRfc3986(key) + "=" + ChromeExOAuth.toRfc3986(value);
};

ChromeExOAuth.prototype.setToken = function(token) {
    localStorage[this.key_token + encodeURI(this.oauth_scope)] = token;
};

ChromeExOAuth.prototype.getToken = function() {
    return localStorage[this.key_token + encodeURI(this.oauth_scope)];
};

ChromeExOAuth.prototype.initOAuthFlow = function(callback) {
    
    var bg = chrome.extension.getBackgroundPage();
    bg.initOAuthFlowCallback = callback;
    
    if (!this.hasToken()) {
        // XXX OAUTH 2
        var result = new OAuth2Simple().sign({
            path: this.url_auth_token,
            parameters: {
                'client_id': this.consumer_key,
                'scope': this.oauth_scope
            }
        });
        window.location.href = result.signed_url;
    } else {
        callback(this.getToken());
    }
};

ChromeExOAuth.prototype.onCodeReceived = function(oauth_code) {
    var bg = chrome.extension.getBackgroundPage();
    if(bg.chromeExOAuthRequestingAccess === false) {
        bg.chromeExOAuthRequestingAccess = true;

        var result = new OAuth2Simple().sign({
            path: this.url_access_token,
            parameters: {
                'client_id': this.consumer_key,
                'client_secret': this.consumer_secret,
                'code': oauth_code
            }
        });
        var callback = bg.initOAuthFlowCallback;
        var onToken = ChromeExOAuth.bind(this.onAccessToken, this, callback);
        ChromeExOAuth.sendRequest("GET", result.signed_url, null, null, onToken);
    }  
};

/**
 * Called when an access token has been returned.  Stores the access token and
 * access token secret for later use and sends them to the supplied callback.
 * @param {Function} callback The function to call once the token is obtained.
 *     This callback will be passed the following arguments:
 *         token {String} The OAuth access token.
 *         secret {String} The OAuth access token secret.
 * @param {XMLHttpRequest} xhr The XMLHttpRequest object used to fetch the
 *     access token.
 */
ChromeExOAuth.prototype.onAccessToken = function(callback, xhr) {
    if (xhr.readyState == 4) {
        var bg = chrome.extension.getBackgroundPage();
        if (xhr.status == 200) {
            var params = ChromeExOAuth.formDecode(xhr.responseText);
            var token = params["access_token"];
            console.log(params);
            this.setToken(token);
            bg.chromeExOAuthRequestingAccess = false;
            callback(token);
        } else {
            bg.chromeExOAuthRequestingAccess = false;
            throw new Error("Fetching access token failed with status " + xhr.status);
        }
    }
};