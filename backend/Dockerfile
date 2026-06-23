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

# Chain: schema → curated knowledge graph (concepts/relationships for the symbolic
# retrieval leg) → PDF corpus (ignoring errors) → retrieval-upgrade migration
# (re-embed + re-segment existing data, ignoring errors) → dev server.
CMD ["sh", "-c", "npm run init-schema && (npm run seed:knowledge || true) && (npm run seed:pdf || true) && (npm run reembed || true) && (npm run reprocess-docs || true) && npm run dev"]
