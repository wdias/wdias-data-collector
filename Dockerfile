FROM golang:1.13-alpine

WORKDIR /go/src/app
RUN apk update && apk add git sqlite gcc g++ npm
# RUN go get -u github.com/kataras/iris
# Breaking change: https://github.com/kataras/iris/issues/1385#issuecomment-546643215
# RUN go get -u github.com/kataras/iris/v12@v12.0.1
RUN go get github.com/iris-contrib/cloud-native-go
RUN go get -u github.com/influxdata/influxdb1-client/v2
RUN go get -u github.com/mattn/go-sqlite3
RUN go get -u k8s.io/apimachinery/pkg/apis/meta/v1
RUN go get -u k8s.io/client-go/kubernetes
RUN go get -u k8s.io/client-go/rest
COPY ./src .
COPY ./web/build ./build

RUN go get -d -v ./...
RUN go install -v ./...

CMD ["app"]
