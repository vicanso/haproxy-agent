var _ = require('lodash');
var co = require('co');
var fs = require('fs');
var path = require('path');
var util = require('util');
var url = require('url');
var crypto = require('crypto');
var spawn = require('child_process').spawn;
var request = require('superagent');
if(!validateEnv()){
  return;
}

setTimeout(function(){
  createHaproxyConfig();
}, 1000);
/**
 * [createHaproxyConfig description]
 * @return {[type]}
 */
function createHaproxyConfig(currentHaproxyCfgHash){
  var timer;
  var finished = function(){
    if(timer){
      clearTimeout(timer);
    }
    timer = setTimeout(function(){
      timer = 0;
      createHaproxyConfig(currentHaproxyCfgHash);
    }, 60 * 1000);
  };
  co(function *(){
    var serverList = yield getServers();
    var hash = getHash(serverList);
    if(serverList.length && currentHaproxyCfgHash !== hash){
      var arr = [];
      _.forEach(serverList, function(server, i){
        arr.push(util.format('  server %s %s:%s check inter 3000 weight 1', server.name, server.ip, server.port));
      });
      var tpl = yield function(done){
        var file = path.join(__dirname, './template/haproxy.tpl');
        fs.readFile(file, 'utf8', done);
      };
      var template = _.template(tpl);
      var cfg = template({
        updatedAt : getDate(),
        serverList : arr.join('\n'),
        name : process.env.NAME
      });
      var result = fs.writeFileSync('/etc/haproxy/haproxy.cfg', cfg);
      if(!result){
        var cmd = spawn('service', ['haproxy', 'reload']);
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
 * @param  {[type]} serverList [description]
 * @return {[type]}            [description]
 */
function *getServers(){
  var result = yield function(done){
    var key = process.env.VARNISH_KEY;
    var urlInfo = getEtcd();
    var etcUrl = util.format('http://%s:%s/v2/keys/%s', urlInfo.hostname, urlInfo.port, key)
    request.get(etcUrl).end(done)
  };
  var nodes = _.get(result, 'body.node.nodes');
  var list = [];
  _.forEach(nodes, function(node){
    list.push(node.value);
  });
  var backendList = [];
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
  var str = JSON.stringify(servers);
  var shasum = crypto.createHash('sha1');
  shasum.update(str);
  return shasum.digest('hex');
}


/**
 * [getDate 获取日期字符串，用于生成版本号]
 * @return {[type]} [description]
 */
function getDate(){
  var date = new Date();
  var month = date.getMonth() + 1;
  if(month < 10){
    month = '0' + month;
  }
  var day = date.getDate();
  if(day < 10){
    day = '0' + day;
  }
  var hours = date.getHours();
  if(hours < 10){
    hours = '0' + hours;
  }
  var minutes = date.getMinutes();
  if(minutes < 10){
    minutes = '0' + minutes;
  }
  var seconds = date.getSeconds();
  if(seconds < 10){
    seconds = '0' + seconds;
  }
  return '' + date.getFullYear() + '-' + month + '-' + day + 'T' + hours + ':' + minutes + ':' + seconds; 
}


/**
 * [validateEnv 校验env的合法性]
 * @return {[type]} [description]
 */
function validateEnv(){
  var env = process.env;
  var keys = 'ETCD NAME VARNISH_KEY'.split(' ');
  var fail = false;
  _.forEach(keys, function(key){
    if(!env[key]){
      fail = true;
    }
  });
  if(fail){
    console.error('参数：' + keys.join(',') + '均不能为空！');
    return false;
  }
  return true;
}


function getEtcd(){
  return url.parse(process.env.ETCD);
}