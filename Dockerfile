FROM golang:1.11.4-alpine

WORKDIR /go/src/app
RUN apk update && apk add git sqlite gcc g++
RUN go get -u github.com/kataras/iris 
RUN go get -u github.com/mattn/go-sqlite3
RUN go get -u k8s.io/apimachinery/pkg/apis/meta/v1
RUN go get -u k8s.io/client-go/kubernetes
RUN go get -u k8s.io/client-go/rest
RUN go get -u github.com/wcharczuk/go-chart
COPY ./src .

RUN go get -d -v ./...
RUN go install -v ./...

CMD ["app"]
