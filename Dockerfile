FROM golang:1.13-alpine

WORKDIR /go/src/app
RUN apk update && apk add git sqlite gcc g++ npm
# RUN go get -u github.com/kataras/iris
# Breaking change: https://github.com/kataras/iris/issues/1385#issuecomment-546643215
# RUN go get -u github.com/kataras/iris/v12@v12.0.1
#RUN go get github.com/iris-contrib/cloud-native-go
ENV GO111MODULE=on
COPY go.mod go.sum ./
RUN go mod download
COPY ./bin/run.sh run.sh

COPY ./src .
RUN go build -o main .

COPY ./web/build ./build

CMD ["./run.sh"]
