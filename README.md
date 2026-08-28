# Test Data Studio UI

React UI for creating api-automation test data from Swagger/OpenAPI schemas.

The app calls `/api/specs` and `/api/testdata` through the Vite proxy to `testdata-generator-api` at `http://localhost:8083`.

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

To call the API directly instead of the proxy, set `VITE_API_BASE=http://localhost:8083` in `.env` and restart `npm run dev`.

Pages are generated from the spec: each OpenAPI operation becomes a route, and request fields are rendered from that operation's JSON Schema.
