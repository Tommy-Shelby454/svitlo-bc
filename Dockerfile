FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev \
 && npx playwright install --with-deps chromium \
 && rm -rf /var/lib/apt/lists/*
COPY server ./server
COPY public ./public
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["node", "server/server.js"]
