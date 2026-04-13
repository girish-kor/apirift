FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:18-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p logs reports && chmod +x src/cli.js
EXPOSE 8080
ENTRYPOINT ["node", "src/cli.js"]
CMD ["--help"]
