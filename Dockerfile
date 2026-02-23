FROM node:22-slim

WORKDIR /app

# Copy package files first for better caching
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN cd client && npm install && cd ../server && npm install

# Copy source code
COPY client/ ./client/
COPY server/ ./server/
COPY models/ ./models/

# Build client + server
RUN cd client && npx vite build && cd ../server && npx tsc

# Expose port (HF Spaces uses 7860)
ENV PORT=7860
EXPOSE 7860

CMD ["node", "server/dist/index.js"]
