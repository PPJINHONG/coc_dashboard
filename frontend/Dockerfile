# 공통 버전 파일에서 전달받습니다. Dockerfile에 버전 숫자를 중복하지 않습니다.
ARG NODE_IMAGE
ARG NGINX_IMAGE
# 빌드 단계: npm lock 파일에 고정된 의존성으로 React 정적 파일을 만듭니다.
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 실행 단계: 빌드 파일만 옮깁니다. Node와 node_modules는 실행 이미지에 없습니다.
FROM ${NGINX_IMAGE}
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
