FROM golang:1.24.7-alpine as build

# рабочая директория для сборки
WORKDIR /build

# скопируем go.mod и go.sum в корень билда
COPY go.mod go.sum ./
RUN go mod download

# скопируем весь проект
COPY . .
#COPY .env /app/.env

# теперь переходим в папку backend, где лежит main.go
WORKDIR /build

RUN apk add --no-cache make

# собираем бинарник
RUN go build -o /build/app .

# ---------------- runner stage ----------------
FROM alpine AS runner

WORKDIR /app

RUN apk add --no-cache curl

# копируем бинарь и миграции
#COPY --from=build /build/bin /app
#COPY --from=build /build/migrations /app/migrations
COPY --from=build /build/app /app/app
COPY --from=build /build/migrations /app/migrations

EXPOSE 9000

CMD ["/app/app"]

