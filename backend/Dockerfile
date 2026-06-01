FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# We use a shell script or command chain to run init-schema, then seed:pdf (ignoring errors), then dev
CMD ["sh", "-c", "npm run init-schema && (npm run seed:pdf || true) && npm run dev"]
