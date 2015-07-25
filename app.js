'use strict';
const _ = require('lodash');
const co = require('co');
const fs = require('fs');
const etcd = require('./lib/etcd');
const path = require('path');
const util = require('util');
const url = require('url');
const crypto = require('crypto');
const spawn = require('child_process').spawn;
etcd.url = process.env.ETCD || 'http://localhost:4001';
const etcdKey = process.env.BACKEND_KEY || 'haproxy-backends';

setTimeout(function(){
  createHaproxyConfig();
}, 1000);
/**
 * [createHaproxyConfig description]
 * @return {[type]}
 */
function createHaproxyConfig(currentHaproxyCfgHash){
  let timer;
  let finished = function(){
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(function(){
      timer = 0;
      createHaproxyConfig(currentHaproxyCfgHash);
    }, 60 * 1000);
  };
  co(function *(){
    let serverList = yield getServers(etcdKey);
    let hash = getHash(serverList);
    if(serverList.length && currentHaproxyCfgHash !== hash){
      let arr = [];
      _.forEach(serverList, function(server, i){
        let weight = server.weight || 1;
        arr.push(util.format('  server %s %s:%s check inter 3000 weight %d', server.name, server.ip, server.port, weight));
      });
      let tpl = yield function(done){
        let file = path.join(__dirname, './template/haproxy.tpl');
        fs.readFile(file, 'utf8', done);
      };
      let template = _.template(tpl);
      let cfg = template({
        updatedAt : getDate(),
        serverList : arr.join('\n'),
        name : process.env.NAME || 'unknow'
      });
      let result = fs.writeFileSync('/etc/haproxy/haproxy.cfg', cfg);
      if(!result){
        let cmd = spawn('service', ['haproxy', 'reload']);
        cmd.on('close', function(code){
          if(code === 0){
            currentHaproxyCfgHash = hash;
          }
        });
        cmd.on('error', function(err){
          console.error(err);
        });
      }
    }
    finished();
  }).catch(function(err){
    console.error(err);
    finished();
  });
}

/**
 * [getServers 获取服务器列表]
 * @param  {[type]} key [description]
 * @return {[type]}     [description]
 */
function *getServers(key){
  let result = yield etcd.get(etcdKey);
  let nodes = result.nodes;
  let list = [];
  _.forEach(nodes, function(node){
    list.push(node.value);
  });
  let backendList = [];
  _.forEach(_.uniq(list), function(v){
    try{
      backendList.push(JSON.parse(v));
    }catch(err){
      console.error(err);
    }
  });
  backendList = _.sortBy(backendList, function(item){
    return item.ip + item.port + item.name;
  });
  return backendList;
}

/**
 * [getHash description]
 * @param  {[type]} servers [description]
 * @return {[type]}         [description]
 */
function getHash(servers){
  let str = JSON.stringify(servers);
  let shasum = crypto.createHash('sha1');
  shasum.update(str);
  return shasum.digest('hex');
}


/**
 * [getDate 获取日期字符串，用于生成版本号]
 * @return {[type]} [description]
 */
function getDate(){
  let date = new Date();
  let month = date.getMonth() + 1;
  if(month < 10){
    month = '0' + month;
  }
  let day = date.getDate();
  if(day < 10){
    day = '0' + day;
  }
  let hours = date.getHours();
  if(hours < 10){
    hours = '0' + hours;
  }
  let minutes = date.getMinutes();
  if(minutes < 10){
    minutes = '0' + minutes;
  }
  let seconds = date.getSeconds();
  if(seconds < 10){
    seconds = '0' + seconds;
  }
  return '' + date.getFullYear() + '-' + month + '-' + day + 'T' + hours + ':' + minutes + ':' + seconds;
}
