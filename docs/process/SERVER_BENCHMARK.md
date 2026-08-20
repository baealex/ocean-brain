# Ocean Brain Server Benchmark

Updated: 2026-08-20

## 1. Purpose

This benchmark isolates the HTTP and GraphQL framework overhead of the Express-to-Fastify migration. It is a recorded local microbenchmark, not a production capacity estimate: the selected requests do not perform note search, writes, or other meaningful database work.

## 2. Compared implementations

- Express baseline: commit `dbd282f6c54cee6e5fa5bea48f37627faeee5526`, Express `5.2.1`, and `graphql-http` `1.22.4`.
- Fastify candidate: branch `feat/fastify-plugin-migration`, Fastify `5.12.1`, and Mercurius `16.10.0`.

Both servers used production builds, a fresh migrated SQLite database, explicit open auth, `127.0.0.1:6684`, and disabled request logging. The Express comparison worktree changed only its logger registration so `OCEAN_BRAIN_HTTP_LOG=false` had the same effect as the Fastify candidate.

## 3. Environment and workload

- Apple M1 Pro, 32 GiB RAM, macOS `26.6.1`, arm64
- Node.js `24.19.0`, pnpm `10.25.0`, autocannon `8.0.0`
- 50 concurrent connections, pipelining 1, 10 seconds per sample
- 3-second warm-up followed by 3 measured samples per endpoint and implementation
- `GET /api/auth/session`
- `POST /graphql` with `{"query":"query { __typename }"}`

All measured samples completed with zero transport errors and zero non-2xx responses.

## 4. Results

| Endpoint | Implementation | Requests/sec | Average latency | p97.5 latency |
| --- | --- | ---: | ---: | ---: |
| Auth session API | Express | 36,343.86 | 1.05 ms | 2 ms |
| Auth session API | Fastify | 59,347.88 | 0.12 ms | 1 ms |
| Auth session API | Change | **+63.3%** | **-88.6%** | **-50.0%** |
| GraphQL typename | Express | 10,935.61 | 4.20 ms | 7 ms |
| GraphQL typename | Fastify + Mercurius | 36,157.58 | 1.11 ms | 2 ms |
| GraphQL typename | Change | **+230.6%** | **-73.6%** | **-71.4%** |

Raw requests/sec samples:

- Auth session Express: `35475.20`, `37121.46`, `36434.91`
- Auth session Fastify: `58706.91`, `59050.19`, `60286.55`
- GraphQL Express: `10823.64`, `11077.60`, `10905.60`
- GraphQL Fastify + Mercurius: `35794.91`, `36993.46`, `35684.37`

The API result mostly reflects Fastify's lower routing and serialization overhead. The GraphQL result also includes Mercurius behavior such as its compiled execution path and query caching, so it should be understood as the gain from the complete GraphQL stack migration rather than Fastify alone. Real note operations will show smaller relative gains when database, Markdown conversion, search, or network work dominates.

## 5. Reproduction

Build and start each implementation separately with the same environment. Use a different fresh data directory for each one:

```bash
pnpm --filter @ocean-brain/server build

NODE_ENV=production \
HOST=127.0.0.1 \
PORT=6684 \
OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH=true \
OCEAN_BRAIN_HTTP_LOG=false \
OCEAN_BRAIN_DATA_DIR=/tmp/ocean-brain-bench \
OCEAN_BRAIN_IMAGE_DIR=/tmp/ocean-brain-bench/images \
DATABASE_URL=file:/tmp/ocean-brain-bench/db.sqlite3 \
node packages/server/dist/start.js
```

Warm up for three seconds, then run each JSON-producing command three times:

```bash
pnpm dlx autocannon@8.0.0 -j -c 50 -d 10 \
  http://127.0.0.1:6684/api/auth/session

pnpm dlx autocannon@8.0.0 -j -c 50 -d 10 \
  -m POST \
  -H 'content-type: application/json' \
  -b '{"query":"query { __typename }"}' \
  http://127.0.0.1:6684/graphql
```

Compare the arithmetic mean of `requests.average`, `latency.average`, and `latency.p97_5`. Keep logging, auth mode, database state, Node.js version, concurrency, duration, and host hardware fixed between candidates.

## 6. Evidence limits

Treat the percentages above as directional migration evidence, not as a release-grade reproducible benchmark. The original run retained the request-rate samples but not the complete autocannon JSON or per-sample latency values. The Fastify candidate was measured from an uncommitted working tree, so the branch name alone does not identify its exact source snapshot.

The Express baseline disabled request logging by skipping `app.use(logger)` when `OCEAN_BRAIN_HTTP_LOG=false`; that one-line comparison patch was not committed. A future published benchmark should record both immutable commit SHAs, preserve that patch and every autocannon JSON result, and run the recipe again from clean worktrees before making a public performance claim.
