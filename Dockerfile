# haproxy 1.5.10

FROM vicanso/iojs

MAINTAINER "vicansocanbico@gmail.com"

ADD . /haproxy-agent

EXPOSE 80

RUN apt-get install haproxy -y \
  && cd /haproxy-agent && npm install --production  --registry=https://registry.npm.taobao.org

CMD service haproxy start && cd /haproxy-agent && pm2 start pm2.json && tail -f /haproxy-agent/package.json
