# Debian-based (glibc) image — Alpine's musl libc is incompatible with the
# prebuilt native binaries in onnxruntime-node (used by @huggingface/transformers
# for local embeddings), which require ld-linux-x86-64.so.2 + OpenMP.
FROM node:24-slim

WORKDIR /app

# libgomp1 = OpenMP runtime required by onnxruntime-node
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

# We use a shell script or command chain to run init-schema, then seed:pdf (ignoring errors), then dev
CMD ["sh", "-c", "npm run init-schema && (npm run seed:pdf || true) && npm run dev"]
