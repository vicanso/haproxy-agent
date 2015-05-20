var _ = require('lodash');
var co = require('co');
var fs = require('fs');
var path = require('path');
var util = require('util');
var url = require('url');
var Etcd = require('node-etcd');
var crypto = require('crypto');
var spawn = require('child_process').spawn;
var varnishKey = 'varnish';
var etcdServer = process.env.ETCD || 'etcd://127.0.0.1:4001';
var urlInfo = url.parse(etcdServer);
var etcd = new Etcd(urlInfo.hostname, urlInfo.port);



var currentHaproxyConfig = '';
var checkInterval = 60 * 1000;
setTimeout(createHaproxyConfig, checkInterval);
/**
 * [createHaproxyConfig description]
 * @return {[type]}
 */
function createHaproxyConfig(){
  co(function *(){
    var serverList = yield getServers();
    if(serverList.length){
      var arr = [];
      _.forEach(serverList, function(server, i){
        arr.push(util.format('  server varnish%d %s:%s check inter 5000 rise 3 fail 3 weight 1', i, server.ip, server.port));
      });
      var tpl = yield function(done){
        var file = path.join(__dirname, './template/haproxy.tpl');
        fs.readFile(file, 'utf8', done);
      };
      var template = _.template(tpl);
      var cfg = template({
        serverList : arr.join('\n')
      });
      var result = fs.writeFileSync('/etc/haproxy/haproxy.cfg', cfg);
      if(!result){
        currentHaproxyConfig = cfg;
        var cmd = spawn('service', ['haproxy', 'reload']);
        cmd.on('error', function(err){
          console.error(err);
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
    etcd.get(varnishKey, done);
  };
  var nodes = _.get(result, '[0].node.nodes');
  var list = [];
  _.forEach(nodes, function(node){
    list.push(node.value);
  });
  var backendList = _.map(_.uniq(list), function(v){
    return JSON.parse(v)
  })
  return backendList;
}