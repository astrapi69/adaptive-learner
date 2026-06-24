FROM node:24-slim AS build

WORKDIR /app
COPY package.json package-lock.json* ./
# --legacy-peer-deps: #266 eslint@10 vs eslint-plugin-react ^9.7 peer cap
# (same flag every CI workflow uses; without it npm ci fails ERESOLVE).
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# The nginx:alpine entrypoint runs envsubst over /etc/nginx/templates/*.template
# at container start, writing the result to /etc/nginx/conf.d/. So the internal
# nginx listen port and the backend upstream port come from the environment
# (ADAPTIVE_LEARNER_NGINX_PORT / ADAPTIVE_LEARNER_BACKEND_PORT), letting the
# launcher's expert internal-port change take effect on rebuild. Only the two
# declared vars are substituted; nginx's own $host/$uri/... survive.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV ADAPTIVE_LEARNER_NGINX_PORT=80
ENV ADAPTIVE_LEARNER_BACKEND_PORT=8000
EXPOSE 80
