FROM golang:1.11.4-alpine

WORKDIR /go/src/app
RUN apk update && apk add git sqlite gcc g++
RUN go get -u github.com/kataras/iris 
RUN go get -u github.com/mattn/go-sqlite3
COPY ./src .

RUN go get -d -v ./...
RUN go install -v ./...

CMD ["app"]
