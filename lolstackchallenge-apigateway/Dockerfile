FROM node:carbon

#create app dir
WORKDIR /usr/src/app

#dependencies
COPY package*.json ./

RUN npm install

#bundle app
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
