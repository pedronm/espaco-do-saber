FROM golang:1.24-alpine AS build

WORKDIR /app
COPY go.mod /app/go.mod
RUN go mod download

COPY . /app
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /app/video-streaming /app/main.go

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /app/video-streaming /app/video-streaming

EXPOSE 1935 8083
CMD ["/app/video-streaming"]
