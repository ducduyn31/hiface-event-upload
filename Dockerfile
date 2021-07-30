FROM node:15.12.0 AS builder
WORKDIR /app
COPY ./package.json ./
RUN npm install
COPY . .
RUN npm run build


FROM node:15.12.0-alpine3.13
WORKDIR /app
COPY --from=builder /app ./
CMD ["npm", "run", "start:prod"]

