FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build


FROM nginx:alpine

RUN apk update \
    && apk upgrade --available --no-cache \
    && apk add --no-cache 'tiff>=4.7.2-r0'

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

LABEL org.opencontainers.image.source="https://github.com/TsiryNajoro/fixbook-front"