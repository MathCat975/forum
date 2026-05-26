FROM golang:1.24-alpine AS builder

RUN apk add --no-cache gcc musl-dev sqlite-dev

WORKDIR /src/BackEnd
COPY Projet/BackEnd/go.mod Projet/BackEnd/go.sum ./
RUN sed -i 's/^go .*/go 1.24/' go.mod && go mod download

COPY Projet/BackEnd/ ./
RUN sed -i 's/^go .*/go 1.24/' go.mod && \
    CGO_ENABLED=1 go build -o /forum .

FROM alpine:3.20

RUN apk add --no-cache sqlite-libs ca-certificates

WORKDIR /app/BackEnd

COPY --from=builder /forum ./forum
COPY Projet/FrontEnd/ /app/FrontEnd/

RUN mkdir -p ./uploads

EXPOSE 8080

CMD ["./forum"]
