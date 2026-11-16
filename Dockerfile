# syntax=docker/dockerfile:1
FROM maven:3.9.11-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY Supaclothes-backend/pom.xml Supaclothes-backend/pom.xml
COPY Supaclothes-backend/src/main/ Supaclothes-backend/src/main/
COPY Supaclothes-frontend/ Supaclothes-frontend/
RUN --mount=type=cache,target=/root/.m2/repository \
    mvn -B -ntp -f Supaclothes-backend/pom.xml -Dmaven.test.skip=true package \
    && mv Supaclothes-backend/target/supaclothes-*.jar /app.jar

FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY --from=build /app.jar app.jar
USER 10001:10001
ENV PORT=10000 SPRING_PROFILES_ACTIVE=render
EXPOSE 10000
ENTRYPOINT ["java", "-Xmx380m", "-XX:+UseSerialGC", "-XX:ActiveProcessorCount=1", "-jar", "/app/app.jar"]
