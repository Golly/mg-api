(function(window, angular, _, undefined) {
    'use strict';

    angular.module('mgApi', []);

    angular
        .module('mgApi')
        .factory('mgApi' , mgApi);

    mgApi.$inject = ['$http', '$q', '$injector', '$timeout', 'mgResource'];
    function mgApi($http, $q, $injector, $timeout, mgResource){
        var transformFn = {};

        var service = {
            resource: resource,
            transform: transform
        };

        return service;
        ///////////////////

        function resource(name, data, parent)
        {
            if (data == null) data = null;
            if (parent == null) parent = null;

            return _applyTransform(mgResource.getResource(name, data, parent));
        }

        function transform(name, transformFn)
        {
            if (transformFn[name] == null) {
                transformFn[name] = [];
            }
            return transformFn[name].push(transformFn);
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
            var fn, name, ref;

            name = _.compact(_.pluck(_tree(resource), 'name')).join('.'); //joined hierarchy string
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

    angular
        .module('mgApi')
        .factory('mgClient' , mgClient);

    mgClient.$inject = ['$http', '$injector'];
    function mgClient($http, $injector){
        var interceptors = [];

        var service = {
            error: error,
            request: request,
            makeRequest: makeRequest,
            get: get,
            post: post,
            put: put,
            delete: deleteFn
        };

        return service;
        ///////////////////

        function error(){
            return angular.noop;
        }

        function request(method, url, config){
            var key, value, ref;

            config = config || {};

            if (method === 'post' || method === 'put') {
                url = url.replace(/\?.+$/, '');
                ref = config.data;
                for (key in ref) {
                    value = ref[key];
                    if (key.match(/^(\$|_)/)) {
                        delete config.data[key];
                    }
                }
            }

            config.method = method;
            config.url = url;
            config.headers = {};

            _intercept('request', config);

            return makeRequest(config, err);
        }

        function makeRequest(config){
            return $http(config).then(function(response){
                return response.data;
            });
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

        function _intercept(type, data) {
            var results = [];
            var interceptor;

            for(var i = 0; i < interceptors.length; i++ ){
                interceptor = $injector.invoke(interceptors[i]);
                if (interceptor[type]) {
                    results.push(interceptor[type](data));
                } else {
                    results.push(void 0);
                }
            }

            return results;
        }
    }

    angular
        .module('mgApi')
        .factory('mgResource' , mgResource);

    mgApi.$inject = ['$http', '$q', 'mgUrl'];
    function mgResource($http, $q, mgUrl) {

        var service = {
            getResource: getResource
        };

        return service;
        ///////////////////

        function Resource(name, data, parent) {
            this.name = name;
            this.parent = parent || null;
            this.urls = {
                base: angular.isString(data) || angular.isNumber(data) ? data : this.name
            };
            if (data != null) this.set(data);
            this.loaders = {};
        }

        Resource.prototype.set = function(data) {
            var link, name, ref;

            if (angular.isObject(data) && (data._links != null)) {
                ref = data._links;

                for (name in ref) {
                    link = ref[name];
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

        //
        Resource.prototype.get = function(params, err) {
            var _this = this;

            return Client.get(this.url(), params, err).then(function(data) {
                return _this.set(data);
            });
        };

        Resource.prototype.post = function(data, err) {
            var _this = this;

            return Client.post(this.url(), data, err).then(function(data) {
                return _this.set(data);
            });
        };

        Resource.prototype.put = function(data, err) {
            var _this = this;

            return Client.put(this.url(), data, err).then(function(data) {
                return _this.set(data);
            });
        };

        Resource.prototype.remove = function(err) {
            return Client["delete"](this.url(), err);
        };
        //

        Resource.prototype.create = function(data, err) {
            return this.post(data, err);
        };

        Resource.prototype.update = function(data, err) {
            return this.put(data, err);
        };

        Resource.prototype.save = function(data, err) {
            if (this.urls.self) {
                return this.update(data, err);
            } else {
                return this.create(data, err);
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
