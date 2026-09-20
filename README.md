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
| History | `GET` `DELETE /api/runs` |
| List / create / update / apply / delete environments | `GET` `POST` `PUT` `DELETE /api/specs/{id}/environments` |

## Environments

An environment is a named host for one spec (`local`, `int`, `prod`). It is **not** a folder of test cases. Plans and cases stay on the spec; the environment only stores a **base URL** and an **auth type** for CI.

```
Spec (employee-service)
├── Plans (Default, Smoke, Negative)  → cases
└── Environments (local, int)         → host + auth placeholders
```

Studio seeds a `local` environment from the spec URL the first time you open a spec with none saved.

### In the workspace bar

| Control | What it does |
|---------|----------------|
| **Environment** menu | Switches the active host. Choosing `int` **applies** that environment: the spec Base URL becomes the int URL, and saved cases that still used the previous spec URL are rewritten. Cases with a custom URL are left as-is. |
| **New environment…** | Opens a blank form. Enter a name and base URL, then **Save new**. That creates the environment and switches to it. |
| **Manage environment** | Edits the selected environment’s name, base URL, and auth type. **Save** writes the record. If that environment is the one currently applied, Save also re-applies the URL. **Auth type** also chooses which credential fields **Run authentication** shows. |
| **Delete {name}** | Removes only the environment record. Plans and cases are not deleted. The spec Base URL is not reverted. |
| **Base URL · Change** | Edits the spec host without creating an environment. Same case-rewrite rule as apply. |

**Run authentication** follows the selected environment: Bearer shows a token field, Basic shows username/password, and None shows no credentials. Tokens stay in the browser session and are never stored on the environment. The same auth type is written into the exported JSON as `${AUTOMATION_*}` placeholders for TestNG.

### Export and the runner

On **Export**, **Download environment** writes `testdata.studio.environment/v1` JSON, for example `employee-service.local.environment.json`:

```json
{
  "format": "testdata.studio.environment",
  "version": 1,
  "name": "local",
  "values": { "baseUrl": "http://localhost:8080/employee-service" },
  "auth": { "type": "BEARER", "token": "${AUTOMATION_BEARER_TOKEN}" }
}
```

Keep one collection (the cases) and swap environment files in CI:

```properties
automation.datasource.type=collection
automation.datasource.collection-file=collections/employee-service/Default.collection.json
automation.environment-file=collections/employee-service/environments/int.json
```

The runner applies `values.baseUrl` as the default host and resolves `${AUTOMATION_BEARER_TOKEN}` (and other `AUTOMATION_*` vars) from the process environment. Import on Export is only for bringing a file from another machine; day-to-day create/edit is Manage environment.

Point the Vite `/api` proxy at another host by changing `API_PROXY_TARGET` in the matching env file (or `.env.development.local` / `.env.production.local` for a machine-only override), then restart Vite.

To call the API directly instead of the proxy, set `VITE_API_BASE` to the API origin (no trailing `/api`) in `.env` and restart `npm run dev`.

Pages are generated from the spec: each OpenAPI operation becomes a route, and request fields are rendered from that operation's JSON Schema.
