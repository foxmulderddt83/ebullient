FROM node:20-alpine

WORKDIR /app

# Install dependencies for Baileys (if needed)
RUN apk add --no-cache git

COPY package.json ./
RUN npm install

COPY . .

# Expose health check port
EXPOSE 8080

CMD ["npm", "start"]
