# haproxy 1.5.10

FROM vicanso/haproxy

MAINTAINER "vicansocanbico@gmail.com"

ADD . /haproxy-agent

EXPOSE 80

RUN cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
  && cd /haproxy-agent && npm install --production  --registry=https://registry.npm.taobao.org

CMD service haproxy start && cd /haproxy-agent && NODE_ENV=production node app
