FROM nginx
COPY config/nginx/nginx.conf /etc/nginx/nginx.conf

#remove the default conf.d
RUN rm /etc/nginx/conf.d/*
COPY config/nginx/conf.d/. /etc/nginx/conf.d/
