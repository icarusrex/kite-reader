FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  add_header Permissions-Policy "microphone=(self)";\n  location / { try_files $uri /index.html; }\n  location = /sw.js { add_header Cache-Control "no-cache"; }\n}\n' > /etc/nginx/conf.d/default.conf
