FROM node:24-slim AS build

# bun is the package manager (#1492/#1496); Node 24 stays the script runtime,
# mirroring CI (setup-node + setup-bun). Same bun pin as .github/workflows/*.
RUN npm install --global bun@1.3.14

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

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
