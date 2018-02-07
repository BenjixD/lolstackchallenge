FROM nginx
COPY nginx/config/nginx/nginx.conf /etc/nginx/nginx.conf

#remove the default conf.d
RUN rm /etc/nginx/conf.d/*
COPY nginx/config/nginx/conf.d/. /etc/nginx/conf.d/

#Copy static content
#RUN mkdir /lolstackchallenge-web
COPY lolstackchallenge-web/. /lolstackchallenge-web/
