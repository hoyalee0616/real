FROM nginx:1.27-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html styles.css app.js manifest.webmanifest sw.js /usr/share/nginx/html/
COPY KongKong-English-v1.3.apk /usr/share/nginx/html/
COPY assets/words/*.jpg /usr/share/nginx/html/assets/words/
COPY assets/icons/ /usr/share/nginx/html/assets/icons/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
