'use strict';
const request = require('superagent');
const urlJoin = require('url-join');
const _ = require('lodash');
const parallel = require('co-parallel');
const fs = require('fs');
const setting = require('../setting');
const Client = require('consul-simple-client');
const consulInfo = setting.get('consul');
const consul = new Client({
  host: consulInfo.hostname,
  port: consulInfo.port
});


exports.getHttpBackends = getHttpBackends;
exports.register = register;


/**
 * [getHttpBackends description]
 * @return {[type]} [description]
 */
function* getHttpBackends() {
  let tags = setting.get('backendTag').split(',');
  return yield consul.listByTags(tags);
}



/**
 * [register 注册服务]
 * @return {[type]} [description]
 */
function* register() {
  let hostName = process.env.HOSTNAME;
  let hosts = fs.readFileSync('/etc/hosts', 'utf8');
  // etc hosts中的ip都是正常的，因此正则的匹配考虑的简单一些
  let reg = new RegExp('((?:[0-9]{1,3}\.){3}[0-9]{1,3})\\s*' + hostName);
  let address = _.get(reg.exec(hosts), 1);
  if (!address) {
    throw new Error('can not get address');
  }
  let tags = setting.get('serviceTag').split(',');
  let data = {
    id: hostName,
    service: 'haproxy',
    port: 80,
    tags: tags
  };
  console.info('register options:' + JSON.stringify(data));
  yield consul.register(data);
}


/**
 * [put description]
 * @param  {[type]} argument [description]
 * @return {[type]}          [description]
 */
function* put(url, data) {
  return yield new Promise(function(resolve, reject) {
    request.put(url).send(data).end(function(err, data) {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}
