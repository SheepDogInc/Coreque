/* OAuth2Simple
  * A simpler version of OAuth
  *
  * author:     jr conlin
  * mail:       src@anticipatr.com
  * copyright:  unitedHeroes.net
  * version:    1.0
  * url:        http://unitedHeroes.net/OAuth2Simple
  *
  * Copyright (c) 2009, unitedHeroes.net
  * All rights reserved.
  *
  * Redistribution and use in source and binary forms, with or without
  * modification, are permitted provided that the following conditions are met:
  *     * Redistributions of source code must retain the above copyright
  *       notice, this list of conditions and the following disclaimer.
  *     * Redistributions in binary form must reproduce the above copyright
  *       notice, this list of conditions and the following disclaimer in the
  *       documentation and/or other materials provided with the distribution.
  *     * Neither the name of the unitedHeroes.net nor the
  *       names of its contributors may be used to endorse or promote products
  *       derived from this software without specific prior written permission.
  *
  * THIS SOFTWARE IS PROVIDED BY UNITEDHEROES.NET ''AS IS'' AND ANY
  * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
  * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
  * DISCLAIMED. IN NO EVENT SHALL UNITEDHEROES.NET BE LIABLE FOR ANY
  * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
  * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
var OAuth2Simple;

if (OAuth2Simple === undefined) {
/* Simple OAuth 2.0
     *
     * This class only builds the OAuth elements, it does not do the actual
     * transmission or reception of the tokens. It does not validate elements
     * of the token. It is for client use only.
     *
     * api_key is the API key, also known as the OAuth consumer key
     * shared_secret is the shared secret (duh).
     *
     * Both the api_key and shared_secret are generally provided by the site
     * offering OAuth services. You need to specify them at object creation
     * because nobody <explative>ing uses OAuth without that minimal set of
     * signatures.
     *
     * If you want to use the higher order security that comes from the
     * OAuth token (sorry, I don't provide the functions to fetch that because
     * sites aren't horribly consistent about how they offer that), you need to
     * pass those in either with .setTokensAndSecrets() or as an argument to the
     * .sign() or .getHeaderString() functions.
     *
     * Example:
       <code>
        var oauthObject = OAuth2Simple().sign({path:'http://example.com/rest/',
                                              parameters: 'foo=bar&gorp=banana',
                                              signatures:{
                                                api_key:'12345abcd',
                                                shared_secret:'xyz-5309'
                                             }});
        document.getElementById('someLink').href=oauthObject.signed_url;
       </code>
     *
     * that will sign as a "GET" using "SHA1-MAC" the url. If you need more than
     * that, read on, McDuff.
     */

    /** OAuth2Simple creator
     *
     * Create an instance of OAuth2Simple
     *
     * @param api_key {string}       The API Key (sometimes referred to as the consumer key) This value is usually supplied by the site you wish to use.
     * @param shared_secret (string) The shared secret. This value is also usually provided by the site you wish to use.
     */
    OAuth2Simple = function(consumer_key, shared_secret) {

        this._secrets = {};
        this._parameters = {};

        // General configuration options.
        if (consumer_key !== undefined) {
            this._secrets['consumer_key'] = consumer_key;
        }
        if (shared_secret !== undefined) {
            this._secrets['shared_secret'] = shared_secret;
        }
        
        this._action = "GET";


        this.reset = function() {
            this._parameters = {};
            this._path = undefined;
            return this;
        };

        /** set the parameters either from a hash or a string
         *
         * @param {string,object} List of parameters for the call, this can either be a URI string (e.g. "foo=bar&gorp=banana" or an object/hash)
         */
        this.setParameters = function(parameters) {
            if (parameters === undefined) {
                parameters = {};
            }
            if (typeof(parameters) == 'string') {
                parameters = this._parseParameterString(parameters);
            }
            this._parameters = parameters;

            return this;
        };

        /** convienence method for setParameters
         *
         * @param parameters {string,object} See .setParameters
         */
        this.setQueryString = function(parameters) {
            return this.setParameters(parameters);
        };

        /** Set the target URL (does not include the parameters)
         *
         * @param path {string} the fully qualified URI (excluding query arguments) (e.g "http://example.org/foo")
         */
        this.setURL = function(path) {
            if (path == '') {
                throw ('No path specified for OAuth2Simple.setURL');
            }
            this._path = path;
            return this;
        };

        /** convienence method for setURL
         *
         * @param path {string} see .setURL
         */
        this.setPath = function(path) {
            return this.setURL(path);
        };

        /** set the "action" for the url, (e.g. GET,POST, DELETE, etc.)
         *
         * @param action {string} HTTP Action word.
         */
        this.setAction = function(action) {
            if (action === undefined) {
                action = "GET";
            }
            action = action.toUpperCase();
            if (action.match('[^A-Z]')) {
                throw ('Invalid action specified for OAuth2Simple.setAction');
            }
            this._action = action;
            return this;
        };

        /** sign the request
         *
         * note: all arguments are optional, provided you've set them using the
         * other helper functions.
         *
         * @param args {object} hash of arguments for the call
         *                   {action:, path:, parameters:, method:, signatures:}
         *                   all arguments are optional.
         */
        this.sign = function(args) {
            if (args === undefined) {
                args = {};
            }
           
            // Set any given parameters
            if (args['action'] !== undefined) {
                this.setAction(args['action']);
            }
            if (args['path'] !== undefined) {
                this.setPath(args['path']);
            }
            if (args['parameters'] !== undefined) {
              this.setParameters(args['parameters']);
            }
            return {
              parameters: this._parameters,
              signed_url: this._path + '?' + this._normalizedParameters()
            };
        };

        // Start Private Methods.
        /** convert the parameter string into a hash of objects.
         *
         */
        this._parseParameterString = function(paramString) {
            var elements = paramString.split('&');
            var result = {};
            for (var element = elements.shift(); element; element = elements.shift()) {
                var keyToken = element.split('=');
                var value = '';
                if (keyToken[1]) {
                    value = decodeURIComponent(keyToken[1]);
                }
                if (result[keyToken[0]]) {
                    if (!(result[keyToken[0]] instanceof Array)) {
                        result[keyToken[0]] = Array(result[keyToken[0]], value);
                    } else {
                        result[keyToken[0]].push(value);
                    }
                } else {
                    result[keyToken[0]] = value;
                }
            }
            return result;
        };

        this._oauthEscape = function(string) {
            if (string === undefined) {
                return "";
            }
            if (string instanceof Array) {
                throw ('Array passed to _oauthEscape');
            }
            return encodeURIComponent(string).replace(/\!/g, "%21").
            replace(/\*/g, "%2A").
            replace(/'/g, "%27").
            replace(/\(/g, "%28").
            replace(/\)/g, "%29");
        };

        this._getApiKey = function() {
            if (this._secrets.consumer_key === undefined) {
                throw ('No consumer_key set for OAuth2Simple.');
            }
            this._parameters['oauth_consumer_key'] = this._secrets.consumer_key;
            return this._parameters.oauth_consumer_key;
        };

        this._getAccessToken = function() {
            if (this._secrets['oauth_secret'] === undefined) {
                return '';
            }
            if (this._secrets['oauth_token'] === undefined) {
                throw ('No oauth_token (access_token) set for OAuth2Simple.');
            }
            this._parameters['oauth_token'] = this._secrets.oauth_token;
            return this._parameters.oauth_token;
        };

        this._normalizedParameters = function() {
            var elements = new Array();
            var paramNames = [];
            var ra = 0;
            for (var paramName in this._parameters) {
                if (ra++ > 1000) {
                    throw ('runaway 1');
                }
                paramNames.unshift(paramName);
            }
            paramNames = paramNames.sort();
            pLen = paramNames.length;
            for (var i = 0; i < pLen; i++) {
                paramName = paramNames[i];
 
                if (this._parameters[paramName] instanceof Array) {
                    var sorted = this._parameters[paramName].sort();
                    var spLen = sorted.length;
                    for (var j = 0; j < spLen; j++) {
                        if (ra++ > 1000) {
                            throw ('runaway 1');
                        }
                        elements.push(this._oauthEscape(paramName) + '=' + this._oauthEscape(sorted[j]));
                    }
                    continue;
                }
                elements.push(this._oauthEscape(paramName) + '=' + this._oauthEscape(this._parameters[paramName]));
            }
            return elements.join('&');
        };

        return this;
    };
}