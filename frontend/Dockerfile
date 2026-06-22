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
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
