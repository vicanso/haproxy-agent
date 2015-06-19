#更新时间：<%= updatedAt %>
###全局配置信息###
###参数是进程级的，通常和操作系统（OS）相关###
global
  log 127.0.0.1:514 local0 notice 
  chroot /var/lib/haproxy
  stats socket /run/haproxy/admin.sock mode 660 level admin
  stats timeout 30s
  user haproxy
  group haproxy
  daemon

###默认全局配置信息###
###这些参数可以被利用配置到frontend，backend，listen组件###
defaults
  log global
  mode http
  option httplog
  option dontlognull  #不记录健康检查的日志信息
  option forwardfor #如果后端服务器需要获得客户端真实ip需要配置的参数，可以从Http Header中获得客户端ip
  option http-server-close #client--长连接--haproxy--短连接--webserver
  option abortonclose   #当服务器负载很高的时候，自动结束掉当前队列处理比较久的连接
  retries 3  #3次连接失败就认为服务不可用，也可以通过后面设置
  balance roundrobin    #默认的负载均衡的方式,轮询方式
  timeout connect 10000                 #连接超时
  timeout client 30000                #客户端超时
  timeout server 30000                #服务器超时
  timeout check 3000              #心跳检测超时


###frontend配置###
###注意，frontend配置里面可以定义多个acl进行匹配操作###

frontend 80port
  bind 0.0.0.0:80

  # log the name of the virtual server
  capture request header Host len 40
  # log the beginning of the referrer
  capture request header Referer len 200
  # log the User-Agent
  capture request header User-Agent len 200

  http-request add-header X-Process <%= name %>

  #默认backend
  default_backend varnish



###backend的设置###
backend varnish
  #心跳检测
  option httpchk GET /ping
  balance uri whole
  hash-type consistent
<%= serverList %>
