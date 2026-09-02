# Test Data Studio UI

React UI for creating api-automation test data from Swagger/OpenAPI schemas.

The app calls `/api/specs` and `/api/testdata` through the Vite proxy. The proxy target is `API_PROXY_TARGET` in `.env.development` (dev) and `.env.production` (build/preview). Default is `http://localhost:8083`.

Requires Node.js 18+ (`npm` on PATH).

## Run

Start the API first:

```bash
cd D:\code\swagger-testdata-generator
mvn -pl testdata-generator-api -am spring-boot:run
```

Then start the UI:

```bash
cd D:\code\testdata-studio-ui
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The home page checks `GET /api/testdata/config` and lists specs from `GET /api/specs`.

| UI action | API |
|-----------|-----|
| Load spec URL / paste | `POST /api/specs` |
| Upload OpenAPI file | `POST /api/specs/upload` |
| Open a saved spec | `GET /api/specs/{id}` and `GET /api/specs/{id}/operations` |
| Operation form | `GET /api/specs/{id}/operations/{key}` |
| Save / update / delete case | `POST` `PUT` `DELETE /api/testdata` |
| Generate positive / negative cases | `POST /api/testdata/generate` |
| Generate Smoke / Negative plans | `POST /api/testdata/generate-plans` |
| Export Excel | `POST /api/testdata/export` |

Point the Vite `/api` proxy at another host by changing `API_PROXY_TARGET` in the matching env file (or `.env.development.local` / `.env.production.local` for a machine-only override), then restart Vite.

To call the API directly instead of the proxy, set `VITE_API_BASE` to the API origin (no trailing `/api`) in `.env` and restart `npm run dev`.

Pages are generated from the spec: each OpenAPI operation becomes a route, and request fields are rendered from that operation's JSON Schema.
