FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./server.js
COPY db ./db
COPY middleware ./middleware
COPY public ./public
COPY routes ./routes
COPY utils ./utils

FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/db ./db
COPY --from=build /app/middleware ./middleware
COPY --from=build /app/public ./public
COPY --from=build /app/routes ./routes
COPY --from=build /app/utils ./utils

EXPOSE 3000

CMD ["npm", "start"]