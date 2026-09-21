#!/bin/sh
set -e
: "${API_PROXY_TARGET:=http://127.0.0.1:8083}"
API_PROXY_TARGET="${API_PROXY_TARGET%/}"
export API_PROXY_TARGET
envsubst '${API_PROXY_TARGET}' < /etc/nginx/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g "daemon off;"
