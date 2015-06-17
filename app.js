var _ = require('lodash');
var co = require('co');
var fs = require('fs');
var path = require('path');
var util = require('util');
var url = require('url');
var crypto = require('crypto');
var spawn = require('child_process').spawn;
var varnishKey = 'varnish';
var etcdServer = process.env.ETCD || 'etcd://127.0.0.1:4001';
var urlInfo = url.parse(etcdServer);
var request = require('superagent');
var currentHaproxyCfgHash = '';
var checkInterval = 60 * 1000;
setTimeout(createHaproxyConfig, checkInterval);
createHaproxyConfig();
/**
 * [createHaproxyConfig description]
 * @return {[type]}
 */
function createHaproxyConfig(){
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
        hostname : process.env.HOSTNAME || 'unknown'
      });
      var result = fs.writeFileSync('/etc/haproxy/haproxy.cfg', cfg);
      if(!result){
        var cmd = spawn('service', ['haproxy', 'reload']);
        cmd.on('close', function(code){
          if(code === 0){
            currentHaproxyCfgHash = hash;
          }
        });
      }
    }
    setTimeout(createHaproxyConfig, checkInterval);
  }).catch(function(err){
    console.error(err);
    setTimeout(createHaproxyConfig, checkInterval);
  });
}

/**
 * [getServers 获取服务器列表]
 * @param  {[type]} serverList [description]
 * @return {[type]}            [description]
 */
function *getServers(){
  var result = yield function(done){
    var etcUrl = util.format('http://%s:%s/v2/keys/%s', urlInfo.hostname, urlInfo.port, varnishKey)
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
