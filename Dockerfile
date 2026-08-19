FROM node:24-alpine

WORKDIR /app
COPY server.js index.html styles.css app.js manifest.webmanifest sw.js package.json ./
COPY KongKong-English-v1.5.apk ./
COPY assets/words/*.jpg ./assets/words/
COPY assets/icons/ ./assets/icons/

RUN mkdir -p /data && chown -R node:node /app /data
USER node

ENV PORT=3000
ENV DB_PATH=/data/kongkong.sqlite
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
