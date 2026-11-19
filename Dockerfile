# Contêiner do NoteStyle para o Google Cloud Run (desde a 6.10.87). O server.mjs serve o site e a API.
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 8080
CMD ["node", "server.mjs"]
