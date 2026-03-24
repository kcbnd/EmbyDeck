FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache python3 make g++
RUN npm config set registry https://registry.npmmirror.com && npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache python3 make g++ && npm config set registry https://registry.npmmirror.com && npm install --production
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data
EXPOSE 3000
ENV DB_DIR=/app/data
CMD ["node", "dist/index.js"]
