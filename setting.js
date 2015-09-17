'use strict';
const _ = require('lodash');
const url = require('url');
const setting = {
  consul: url.parse(process.env.CONSUL || 'http://localhost:8500'),
  backendTag: process.env.BACKEND_TAG || 'varnish',
  serviceTag: process.env.SERVICE_TAG || 'haproxy'
};

exports.get = get;

/**
 * [get 获取setting配置]
 * @param  {[type]} key [description]
 * @return {[type]}     [description]
 */
function get(key) {
  return _.get(setting, key);
}
