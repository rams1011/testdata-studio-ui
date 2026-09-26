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

Hosting is one API setting: `TESTDATA_EDITION=local|datacenter|saas` (blank is `datacenter`). `datacenter` requires sign in and shows **Admin**, but hides **Plan**. Accounts are created by an administrator.

| UI action | API |
|-----------|-----|
| Load spec URL / paste | `POST /api/specs` |
| Upload OpenAPI file | `POST /api/specs/upload` |
| Open a saved spec | `GET /api/specs/{id}` and `GET /api/specs/{id}/operations` |
| Operation form | `GET /api/specs/{id}/operations/{key}` |
| Save / update / delete case | `POST` `PUT` `DELETE /api/testdata` |
| Duplicate a case into another environment | `POST /api/testdata/{id}/duplicate` |
| Export collection | Choose **JSON** or **Excel** on Export, then download (`POST /api/testdata/export-collection` or `POST /api/testdata/export`; zip with `files/<caseId>/` when the plan has uploads) |
| History | `GET` `DELETE /api/runs` |
| List / create / update / apply / delete environments | `GET` `POST` `PUT` `DELETE /api/specs/{id}/environments` |

## Environments

An environment is a named host for one spec (`local`, `int`, `prod`). It stores **base URL** and **auth type**. Test cases belong to the environment selected in the workspace bar: **Save**, **Update**, and **Delete** apply only there. Switch Environment to see that host’s case list.

```
Spec (employee-service)
├── Plans (Default, or names you create)
│   └── Cases in local / cases in int   → separate records
└── Environments (local, int)           → host + auth
```

Studio seeds a `local` environment from the spec URL the first time you open a spec with none saved.

### In the workspace bar

| Control | What it does |
|---------|----------------|
| **Spec** | Current name + layers icon (**Switch spec** tooltip). **Ctrl+K** / **⌘K** opens the search palette. **New spec…** at the bottom |
| **Environment** menu | Switches the active host **and** the case list. Choosing `int` **applies** that environment: the spec Base URL becomes the int URL, and saved cases that still used the previous spec URL are rewritten. Cases with a custom URL are left as-is. |
| **New environment…** | Opens a blank form. Enter a name and base URL, then **Save new**. That creates the environment and switches to it. New cases you save belong to it. |
| **Manage environment** | Edits the selected environment’s name, base URL, and auth type. **Save** writes the record and keeps that environment’s cases (a rename from `local` to `dev` does not drop them). If that environment is the one currently applied, Save also re-applies the URL. **Auth type** also chooses which credential fields **Run authentication** shows. |
| **Delete {name}** | Removes the environment and cases that exist only in it. Unstamped leftover cases stay unless you delete them from that environment (they are then stamped onto the remaining environments). The spec Base URL is not reverted. |
| **Duplicate environment** | Copies host, auth, and cases that belong only to the selected environment. |
| **Base URL · Change** | Edits the spec host without creating an environment. Same case-rewrite rule as apply. |

On a saved case, **Duplicate into {environment}** creates a **new** case in the other environment (new id, copied request files). It does not overlay data onto a shared id.

**Run authentication** follows the selected environment: Bearer shows a token field, Basic shows username/password, and None shows no credentials. Tokens stay in the browser session and are never stored on the environment. The same auth type is written into the exported JSON as `${AUTOMATION_*}` placeholders for TestNG.

### Export and the runner

On **Export**, pick a **Collection type** and download the selected plan **for the current environment** as JSON (`testdata.studio.collection/v1`) or Excel. Each case is stamped `environments: ["int"]` when it belongs to that host. **Download environment** writes host and auth only (no leftover `cases{}` overlays), for example `employee-service.local.environment.json`:

```json
{
  "format": "testdata.studio.environment",
  "version": 1,
  "name": "local",
  "values": { "baseUrl": "http://localhost:8080/employee-service" },
  "auth": { "type": "BEARER", "token": "${AUTOMATION_BEARER_TOKEN}" }
}
```

Export once per environment (or filter at run time). Cases with `environments: ["int"]` run only when that environment file’s `name` is `int`. The runner requires `automation.environment-file` when any case has membership. Legacy `cases{}` overlays in an old environment file still apply on run until you save the case in Studio.

```properties
automation.datasource.type=collection
automation.datasource.collection-file=collections/employee-service/Default.collection.json
automation.environment-file=collections/employee-service/environments/int.json
```

The runner applies `values.baseUrl` as the default host and resolves `${AUTOMATION_BEARER_TOKEN}` (and other `AUTOMATION_*` vars) from the process environment. Import on Export is only for bringing a file from another machine; day-to-day create/edit is Manage environment.

Point the Vite `/api` proxy at another host by changing `API_PROXY_TARGET` in the matching env file (or `.env.development.local` / `.env.production.local` for a machine-only override), then restart Vite.

To call the API directly instead of the proxy, set `VITE_API_BASE` to the API origin (no trailing `/api`) in `.env` and restart `npm run dev`.

Pages are generated from the spec: each OpenAPI operation becomes a route, and request fields are rendered from that operation's JSON Schema.
