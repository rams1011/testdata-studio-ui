import { Link } from "react-router-dom";

const SECTIONS = [
  { id: "overview", title: "Overview" },
  { id: "home", title: "Home and specs" },
  { id: "workspace", title: "Workspace bar" },
  { id: "operations", title: "Operations sidebar" },
  { id: "test-case", title: "Building a test case" },
  { id: "request-body", title: "Request body" },
  { id: "response", title: "Expected response and assertions" },
  { id: "run-save", title: "Try, Save, and Run" },
  { id: "cases", title: "Cases page" },
  { id: "environments", title: "Environments" },
  { id: "export", title: "Export" },
  { id: "history", title: "History and last runs" },
  { id: "import", title: "Import curl and collections" },
  { id: "auth", title: "Run authentication" },
  { id: "shortcuts", title: "Shortcuts" }
];

export default function GuidePage() {
  return (
    <div className="hero guide-hero">
      <div className="hero-head guide-head">
        <h1>
          <Link to="/" className="guide-home-link">Test Data Studio</Link>
          <span className="guide-head-sep">·</span>
          User guide
        </h1>
        <Link to="/" className="btn">Back to specs</Link>
      </div>

      <div className="guide-layout">
        <nav className="guide-toc card" aria-label="Guide contents">
          <strong>On this page</strong>
          <ol>
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="guide-body">
          <section id="overview" className="guide-section">
            <h2>Overview</h2>
            <p>
              Test Data Studio turns OpenAPI (Swagger) operations into saved test cases you can run in the UI
              and export for api-automation (JSON or Excel). Work is organized by <strong>spec</strong>,
              <strong> test plan</strong>, and <strong>environment</strong>.
            </p>
            <p className="hint">
              Typical flow: open a spec → pick environment and plan → select an operation → fill request and
              expectations → Save → Run plan or export the collection.
            </p>
          </section>

          <section id="home" className="guide-section">
            <h2>Home and specs</h2>
            <p>From the home page you can:</p>
            <ul>
              <li><strong>Add spec</strong> — paste a URL, upload OpenAPI (JSON/YAML), paste document text, or create a manual REST catalog without Swagger.</li>
              <li><strong>Open</strong> a saved spec to enter the studio.</li>
              <li><strong>Reload</strong> a spec from its source URL or file when the API definition changed.</li>
              <li><strong>Import collection</strong> — bring in a previously exported studio JSON collection.</li>
            </ul>
            <p>
              In SaaS or datacenter mode you may need to sign in and choose a workspace before specs load.
            </p>
          </section>

          <section id="workspace" className="guide-section">
            <h2>Workspace bar</h2>
            <p>The top bar controls what you are editing and where requests are sent.</p>
            <dl className="guide-dl">
              <dt>Spec</dt>
              <dd>
                Current API catalog. Use the layers icon or <kbd>Ctrl</kbd>+<kbd>K</kbd> / <kbd>⌘</kbd>+<kbd>K</kbd> to
                switch specs or create a new one without leaving the studio.
              </dd>
              <dt>Environment</dt>
              <dd>
                Named host (for example local, int, prod) with its own base URL and auth type. Switching environment
                changes which saved cases you see and applies that host&apos;s URL to the spec when selected.
              </dd>
              <dt>Test plan</dt>
              <dd>
                A bucket of cases within the spec (Default or custom names). Plans are independent lists used for
                Run plan and export.
              </dd>
              <dt>Cases</dt>
              <dd>Jump to the plan&apos;s case table — filter, bulk enable/disable, run single cases or the whole plan.</dd>
              <dt>More</dt>
              <dd>Spec settings, run <strong>History</strong>, and <strong>Export</strong>.</dd>
            </dl>
          </section>

          <section id="operations" className="guide-section">
            <h2>Operations sidebar</h2>
            <p>
              Lists every operation in the spec, grouped by tags when enabled. Search filters by name or path.
              Case counts show how many saved cases exist per operation in the current plan and environment.
            </p>
            <p>
              Click an operation to open the case editor. Manual specs also support <strong>Add API</strong> in the
              workspace bar.
            </p>
          </section>

          <section id="test-case" className="guide-section">
            <h2>Building a test case</h2>
            <p>Each case stores metadata and request/response expectations for one operation.</p>
            <ul>
              <li><strong>Test name</strong>, group, enabled flag, base URL, expected HTTP status, response type, max response time.</li>
              <li><strong>Parameters</strong> — path, query, headers, cookies from the OpenAPI schema. Required fields are marked with *.</li>
              <li><strong>Run authentication</strong> — credentials for Try / Run (session-only; not stored on the environment record).</li>
            </ul>
            <p>
              If required fields are missing, Save and Try stay disabled. A summary lists missing fields; click a
              chip to scroll to that field.
            </p>
            <p>
              <strong>Save</strong> creates or updates the case in the current environment.
              <strong> New case</strong> clears the form for another case on the same operation.
              <strong> Import from curl</strong> fills the form from a copied curl command (and can create a manual API if needed).
            </p>
          </section>

          <section id="request-body" className="guide-section">
            <h2>Request body</h2>
            <p>When the operation has a body schema:</p>
            <ul>
              <li><strong>JSON</strong> opens with a <em>template</em> from the schema — every property key with empty placeholders. Edit values in JSON or switch to <strong>Form</strong>.</li>
              <li><strong>Form</strong> — labeled fields matching the schema; use extract placeholders <code>{`{{name}}`}</code> from earlier cases in the plan when configured.</li>
              <li>Multipart file fields are chosen separately; file bytes are not embedded in JSON.</li>
            </ul>
          </section>

          <section id="response" className="guide-section">
            <h2>Expected response and assertions</h2>
            <p><strong>Expected response</strong> is optional. Use Form or JSON/XML to describe the body you expect; leave blank to assert status (and timing) only. <strong>Clear</strong> removes the body after confirmation.</p>
            <p><strong>JSONPath assertions</strong> — select schema paths and optional expected values. Values can follow the expected response document. Use <strong>Select all</strong> or add custom paths. <strong>Clear</strong> deselects all paths after confirmation.</p>
            <p><strong>Extract for later cases</strong> — pick response fields to expose as <code>{`{{variables}}`}</code> for later cases in the same plan run.</p>
          </section>

          <section id="run-save" className="guide-section">
            <h2>Try, Save, and Run</h2>
            <ul>
              <li><strong>Try this request</strong> — sends the current form without saving; path params and base URL are required.</li>
              <li><strong>Save / Update</strong> — persists the case to the current plan and environment.</li>
              <li><strong>Run</strong> on a saved case (operation sidebar list or Cases page) executes one case.</li>
              <li><strong>Run plan</strong> on the Cases page runs enabled cases in order, honoring extracts and prerequisites.</li>
            </ul>
            <p>Results appear in the run panel; failures show status, body, and assertion details.</p>
          </section>

          <section id="cases" className="guide-section">
            <h2>Cases page</h2>
            <p>
              Table of all cases in the current plan and environment. Filter by name, method, or status code;
              select rows for bulk enable, disable, or delete.
            </p>
            <p>
              When the plan has no cases yet, the <strong>Get started</strong> card offers Import from curl and
              (for manual specs) Add API. Import and export actions move to the top bar once cases exist.
            </p>
            <p><strong>Last runs</strong> below the case list shows recent Try / Run / Run plan history for this spec, plan, and environment.</p>
          </section>

          <section id="environments" className="guide-section">
            <h2>Environments</h2>
            <p>
              Cases are scoped to the environment you select. The same logical test can exist separately in
              local and production with different URLs or data.
            </p>
            <ul>
              <li>Create, rename, duplicate, or delete environments from the Environment menu.</li>
              <li><strong>Duplicate into …</strong> on a saved case copies it to another environment.</li>
              <li>Applying an environment updates the spec base URL and may rewrite cases that still used the old host.</li>
            </ul>
          </section>

          <section id="export" className="guide-section">
            <h2>Export</h2>
            <p>
              From <strong>More → Export</strong>, download the current plan for the active environment as a
              studio JSON collection or Excel. Choose JSON when re-importing into the studio or feeding automation;
              Excel for spreadsheet review.
            </p>
            <p>You can also export environment metadata alone (host and auth placeholders) for the runner.</p>
          </section>

          <section id="history" className="guide-section">
            <h2>History and last runs</h2>
            <p>
              <strong>History</strong> stores snapshots of Try, Run, and Run plan executions (when the API uses
              H2 or PostgreSQL). Filter by plan, environment, outcome, and trigger; open a run to inspect
              request/response bodies. Select two results to compare diffs.
            </p>
            <p>
              <strong>Last runs</strong> on Cases and Operation pages is a short list scoped to the current
              plan and environment (and operation when on an operation page).
            </p>
          </section>

          <section id="import" className="guide-section">
            <h2>Import curl and collections</h2>
            <ul>
              <li><strong>Import from curl</strong> — parses method, URL, headers, and body into a new unsaved case (or creates a manual operation).</li>
              <li><strong>Import collection</strong> on the home page — restores a previously exported studio JSON file into a spec/plan.</li>
            </ul>
          </section>

          <section id="auth" className="guide-section">
            <h2>Run authentication</h2>
            <p>
              Set Bearer token, Basic username/password, or API key fields under Run authentication. The
              environment&apos;s auth type controls which fields appear. Credentials are kept in the browser session
              for runs; exports use automation placeholders for CI.
            </p>
            <p>If you see 401 on a run, add or fix authentication before re-running.</p>
          </section>

          <section id="shortcuts" className="guide-section">
            <h2>Shortcuts</h2>
            <ul>
              <li><kbd>Ctrl</kbd>+<kbd>K</kbd> / <kbd>⌘</kbd>+<kbd>K</kbd> — switch spec (when not typing in a field).</li>
            </ul>
          </section>
        </article>
      </div>
    </div>
  );
}
