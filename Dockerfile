FROM node:22-alpine

WORKDIR /app

# Copy package.json and lock file
COPY package*.json ./

# Install dependencies
RUN npm ci || npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy the rest of the backend files
COPY . .

# Expose port and start
EXPOSE 5000
CMD ["npm", "start"]
