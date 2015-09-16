'use strict';
require('./lib/logger');
const _ = require('lodash');
const co = require('co');
const fs = require('fs');
const path = require('path');
const util = require('util');
const url = require('url');
const crypto = require('crypto');
const spawn = require('child_process').spawn;
const consul = require('./lib/consul');
var registered = false;
setTimeout(function() {
  createHaproxyConfig();
}, 1000);
/**
 * [createHaproxyConfig description]
 * @return {[type]}
 */
function createHaproxyConfig(currentHaproxyCfgHash) {
  let timer;
  let finished = function() {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(function() {
      timer = 0;
      createHaproxyConfig(currentHaproxyCfgHash);
    }, 60 * 1000);
  };
  co(function*() {
    let serverList = yield getServers();
    let hash = getHash(serverList);
    if (serverList.length && currentHaproxyCfgHash !== hash) {
      let arr = [];
      _.forEach(serverList, function(server, i) {
        let weight = server.weight || 1;
        arr.push(util.format(
          '  server %s %s:%s check inter 3000 weight %d', server.name,
          server.ip, server.port, weight));
      });
      let file = path.join(__dirname, './template/haproxy.tpl');
      let tpl = fs.readFileSync(file, 'utf8');
      let template = _.template(tpl);
      let cfg = template({
        updatedAt: (new Date()).toISOString(),
        serverList: arr.join('\n'),
        name: process.env.HOSTNAME || 'unknown'
      });
      let result = fs.writeFileSync('/etc/haproxy/haproxy.cfg', cfg);
      if (!result) {
        let cmd = spawn('service', ['haproxy', 'reload']);
        cmd.on('close', function(code) {
          if (code === 0) {
            currentHaproxyCfgHash = hash;
            console.info('restart haproxy successful at:%s', new Date());
            if (!registered) {
              co(function*() {
                yield consul.register();
                registered = true;
              });
            }
          }
        });
        cmd.on('error', function(err) {
          console.error(err);
        });
      }
    }
    finished();
  }).catch(function(err) {
    console.error('message:' + err.message);
    console.error('stack:' + err.stack);
    finished();
  });
}

/**
 * [getServers 获取服务器列表]
 * @return {[type]}     [description]
 */
function* getServers() {
  let backendList = yield consul.getHttpBackends();
  backendList = _.sortBy(backendList, function(item) {
    return item.ip + item.port + item.name;
  });
  return backendList;
}

/**
 * [getHash description]
 * @param  {[type]} servers [description]
 * @return {[type]}         [description]
 */
function getHash(servers) {
  let str = JSON.stringify(servers);
  let shasum = crypto.createHash('sha1');
  shasum.update(str);
  return shasum.digest('hex');
}
