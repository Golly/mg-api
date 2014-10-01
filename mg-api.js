/**
 * mgApi - The authentication suite for AngularJS
 * @version v0.1.0 - 2014-09-29
 * @link http://marting.github.com
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
(function(window, angular, _, undefined) {
    'use strict';

    angular.module('mgApi', []);

    /**
     * @ngdoc service
     * @name mgApi
     * @requires mgAuthNotifier, mgRequestStorage
     *
     * @description
     * Create resource, collection or add transform function for resource
     *
     *
     * Requires the {@link mgApi `mgApi`} module to be installed.
     *
     * @example
     *
     * ```js
     * module.config(['$httpProvider', function($httpProvider){
     *  $httpProvider.responseInterceptors.push('mgError401');
     * }]);
     * ```
     */
    angular
        .module('mgApi')
        .factory('mgApi' , mgApi);

    mgApi.$inject = ['$http', '$q', '$injector', '$timeout', 'mgResource'];
    function mgApi($http, $q, $injector, $timeout, mgResource){
        var baseUrl;
        var transformFn = {};

        var service = {
            setBaseUrl: setBaseUrl,
            resource: resource,
            collection: collection,
            client: client,
            transform: transform
        };

        return service;
        ///////////////////

        function setBaseUrl(url){
            baseUrl = url;
        }

        function resource(name, data, parent) {
            data = data || null;
            parent = parent || null;

            return _applyTransform(mgResource.getResource(name, data, parent));
        }

        function collection(){

        }

        function client(){

        }

        function transform(name, fn) {
            if (transformFn[name] == null) {
                transformFn[name] = [];
            }

            return transformFn[name].push(fn);
        }

        /**
         * Sort resource from root to leaf in array
         */
        function _tree(resource){
            var parent, result;

            parent = resource.parent;
            result = [resource];

            while (parent) {
                result.unshift(parent);
                parent = parent.parent;
            }
            return result;
        }

        /**
         * Apply transform function on Resource or Collection
         */
        function _applyTransform(resource){
            var fn, ref;
            var name = _.compact(_.pluck(_tree(resource), 'name')).join('.'); //joined hierarchy string

            if (transformFn[name]) { //if exist transform function for resource then apply
                ref = transformFn[name];
                for (var i = 0; i < ref.length; i++) {
                    fn = ref[i];
                    fn(resource, resource instanceof Collection);
                }
            }

            return resource;
        }

    }

    /**
     * @ngdoc service
     * @name mgUrl
     * @requires $window
     *
     * @description
     * Helper service for work with url string
     *
     *
     * Requires the {@link mgApi `mgApi`} module to be installed.
     *
     * @example
     *
     * ```js
     * module.config(['$httpProvider', function($httpProvider){
     *  $httpProvider.responseInterceptors.push('mgError401');
     * }]);
     * ```
     */
    angular
        .module('mgApi')
        .factory('mgUrl' , mgUrl);

    mgUrl.$inject = ['$window'];
    function mgUrl($window){

        var service = {
            parse: parse,
            baseUrl: baseUrl,
            expand: expand
        };

        return service;
        ///////////////////

        /**
         * Parse url
         * @param [url]
         */
        function parse(url) {
            var parser;

            if (url) {
                parser = document.createElement('a');
                parser.href = url;
            } else {
                parser = $window.location;
            }

            var result = {
                protocol: parser.protocol.replace(/\:$/, ''),
                hostname: parser.hostname,
                host: parser.host,
                port: parser.port,
                path: parser.pathname,
                search: parser.search.substring(1),
                params: {},
                hash: parser.hash.substring(1)
            };

            // parse query params
            angular.forEach(result.search.split('&'), function(item) {
                var parts = item.split('=');
                if (parts[0]) {
                    result.params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1].replace(/\+/g, ' '));
                }
            });

            return result;
        }

        /**
         * Return base app url
         * @returns {String}
         */
        function baseUrl() {
            return $window.location.href.replace(/#.*$/, '');
        }

        /**
         * Return url with replaced placeholders
         * @param url
         * @returns {String}
         */
        function expand(url) {
            if (url) {
                url = url.replace('%appUrl%', this.baseUrl().replace(/\?.*$/, ''));
            }
            return url;
        }
    }

    /**
     * @ngdoc service
     * @name mgClient
     * @requires $http
     *
     * @description
     * Service for http communication
     *
     *
     * Requires the {@link mgApi `mgApi`} module to be installed.
     *
     * @example
     *
     * ```js
     * module.config(['$httpProvider', function($httpProvider){
     *  $httpProvider.responseInterceptors.push('mgError401');
     * }]);
     * ```
     */
    angular
        .module('mgApi')
        .factory('mgClient' , mgClient);

    mgClient.$inject = ['$http'];
    function mgClient($http){
        var interceptors = [];

        var service = {
            request: request,
            get: get,
            post: post,
            put: put,
            delete: deleteFn
        };

        return service;
        ///////////////////

        function request(method, url, config){
            var key, value, ref;

            config = config || {};

            if (method === 'post' || method === 'put') {
                url = _removeQueryString(url);
                config.data = _removeReservedProperties(config.data);
            }

            config.method = method;
            config.url = url;
            config.headers = {};

            return _makeRequest(config);
        }

        function get(url, params) {
            return request('get', url, {
                params: params
            });
        }

        function post(url, data) {
            return request('post', url, {
                data: data
            });
        }

        function put(url, data) {
            return request('put', url, {
                data: data
            });
        }

        function deleteFn(url) {
            return request('delete', url, null);
        }

        function _makeRequest(config){
            return $http(config).then(function(response){
                return response.data;
            });
        }

        function _removeQueryString(url){
            return url.replace(/\?.+$/, '');
        }

        function _removeReservedProperties(data){
            for (var key in data) {
                if (key.match(/^(\$|_)/)) {
                    delete data[key];
                }
            }

            return data;
        }

    }


    angular
        .module('mgApi')
        .factory('mgResource' , mgResource);

    mgApi.$inject = ['$q', 'mgUrl', 'mgClient'];
    function mgResource( $q, mgUrl, mgClient) {
        var resourceName;
        var resourceParent;
        var urls = {};
        var loaders = {};

        var service = {
            //getResource: getResource
            get:get,
            post: post
        };

        return function(name, data, parent) {
            resourceName = name;
            resourceParent = parent || null;
            urls.base = angular.isString(data) || angular.isNumber(data) ? data : name;
            if (data != null) _setLinks(data);

            return service;
        }
        ///////////////////

        function get(){

        }

        function post(){

        }

        function _setLinks(){

        }

        function Resource(name, data, parent) {
            this.name = name;
            this.parent = parent || null;
            this.urls = {
                base: angular.isString(data) || angular.isNumber(data) ? data : this.name
            };
            if (data != null) this.setLinks(data);
            this.loaders = {};
        }

        Resource.prototype.setLinks = function(data) {
            var link, name, links;

            if (angular.isObject(data) && (data._links != null)) {
                links = data._links;

                for (name in links) {
                    link = links[name];
                    if (link.href != null) {
                        this.urls[name] = link.href;
                    }
                }
            }

            return data;
        };

        Resource.prototype.replaceSelfUrl = function(url) {
            if (String(url).match(/^https?\:\/\//)) {
                return this.urls.self = url;
            } else {
                this.urls.self = null;
                return this.urls.self = this.parent.url(false) + '/' + url;
            }
        };

        Resource.prototype.url = function(base) {
            var url, ref;
            url = this.urls.self || ((ref = this.parent) != null ? ref.urls[this.name] : void 0);
            if (url) {
                url = mgUrl.expand(url);
                if (url.match(/^https?\:\/\//)) {
                    return url;
                }
            } else {
                url = this.urls.base;
                if (this.parent != null) {
                    return this.parent.url(base) + (url ? '/' + url : '');
                }
            }
            if (base) {
                return url;
            } else {
                return config.api.baseUrl + '/' + url.replace(/^\/+/, '');  //Todo: doplnit config
            }
        };

        Resource.prototype.urlWithoutQueryString = function() {
            return this.url().replace(/\/?\?.*$/, '');
        };

        /*
        Resource.prototype.resource = function(name, data) {
            return Api.resource(name, data, this);
        };

        Resource.prototype.collection = function(name, data, dataName) {
            return Api.collection(name, data, this, dataName);
        };
        */

        Resource.prototype.get = function(params) {
            var _this = this;

            return mgClient.get(this.url(), params).then(function(data) {
                return _this.setLinks(data);
            });
        };

        Resource.prototype.post = function(data) {
            var _this = this;

            return mgClient.post(this.url(), data).then(function(data) {
                return _this.setLinks(data);
            });
        };

        Resource.prototype.put = function(data) {
            var _this = this;

            return mgClient.put(this.url(), data).then(function(data) {
                return _this.setLinks(data);
            });
        };

        Resource.prototype.remove = function() {
            return mgClient["delete"](this.url());
        };

        Resource.prototype.create = function(data) {
            return this.post(data);
        };

        Resource.prototype.update = function(data) {
            return this.put(data);
        };

        Resource.prototype.save = function(data) {
            if (this.urls.self) {
                return this.update(data);
            } else {
                return this.create(data);
            }
        };

        Resource.prototype.load = function(what) {
            var queue= [];
            var _this = this;

            if (what == null) what = Object.keys(this.loaders);

            if (!angular.isArray(what)) {
                what = [what];
            }

            angular.forEach(what, function(key) {
                if (_this.loaders[key].$promise == null) {
                    _this.loaders[key].$promise = _this.loaders[key](_this);
                }
                return queue.push(_this.loaders[key].$promise);
            });

            return $q.all(queue)
                .then(function(data) {
                var result = {};

                if (what.length === 1) return data[0];

                angular.forEach(what, function(key, index) {
                    return result[key] = data[index];
                });

                return result;
            });
        };

        function getResource(name, data, parent){
            return new Resource(name, data, parent);
        }

    }

})(window, window.angular, window._);
