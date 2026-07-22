FROM node:24.15.0-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
  && python3 -m venv /opt/overture \
  && /opt/overture/bin/pip install --no-cache-dir overturemaps==1.0.1 \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PATH="/opt/overture/bin:${PATH}"
ENV COURSE_TWIN_OVERTURE_ENABLED=1

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY tools/course-twin-builder ./tools/course-twin-builder

USER node
EXPOSE 8787
CMD ["node", "tools/course-twin-builder/cli.mjs"]
