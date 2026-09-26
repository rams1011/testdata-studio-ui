import SchemaBodyEditor from "./SchemaBodyEditor";
import { schemaHasFormFields } from "../schema";
import { isXmlContentType } from "../xml";

export default function RequestBodyEditor({
  schema,
  value,
  onChange,
  resetKey,
  caseId,
  onEnsureCase,
  onFileCommitted,
  contentType,
  environmentId
}) {
  const xml = isXmlContentType(contentType);
  const structured = schemaHasFormFields(schema);
  return (
    <>
      {xml ? (
        <p className="hint" style={{ margin: "0 0 12px" }}>
          Sent as XML. The XML tab is the payload; Form maps schema fields to elements.
        </p>
      ) : structured ? (
        <p className="hint" style={{ margin: "0 0 12px" }}>
          JSON shows the request template from the API schema. Edit values here or use Form.
        </p>
      ) : null}
      <SchemaBodyEditor
        schema={schema}
        value={value}
        onChange={onChange}
        resetKey={`${resetKey}:${xml ? "xml" : "json"}`}
        caseId={caseId}
        onEnsureCase={onEnsureCase}
        onFileCommitted={onFileCommitted}
        format={xml ? "xml" : "json"}
        defaultTab={structured ? "json" : "auto"}
        searchAria="Search request body fields"
        jsonAria={xml ? "Request body XML" : "Request body JSON"}
        tabsAria="Request body editor"
        allowExtracts
        fileUploads
        environmentId={environmentId}
      />
    </>
  );
}
