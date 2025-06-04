FROM node:22-slim

WORKDIR /app

COPY package*.json ./
COPY src ./src
COPY index.html ./
COPY tsconfig*.json ./
COPY vite.config.ts ./

RUN npm install 
# --production

RUN apt-get update
RUN apt-get install -y unzip curl

RUN mkdir -p ./data
RUN mkdir -p ./data/rt
RUN curl -L -o ./data/gtfs_subway.zip https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip

#RUN ls ./data
RUN ["unzip", "./data/gtfs_subway.zip", "-d", "./data/gtfs_subway"]

#RUN ["npm", "run", "build"]
RUN [ "npx", "tsc", "-p", "tsconfig.build.json" ]
RUN [ "npx", "vite", "build"]

EXPOSE 3000
CMD [ "node", "dist/RealTime.js"]
