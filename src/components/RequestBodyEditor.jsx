import SchemaBodyEditor from "./SchemaBodyEditor";
import { mergeFileRefs, sampleFromSchema } from "../schema";
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
  return (
    <>
      {xml ? (
        <p className="hint" style={{ margin: "0 0 12px" }}>
          Sent as XML. The XML tab is the payload; Form maps schema fields to elements.
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
        searchAria="Search request body fields"
        jsonAria={xml ? "Request body XML" : "Request body JSON"}
        tabsAria="Request body editor"
        onFillSample={() => onChange(mergeFileRefs(sampleFromSchema(schema), value))}
        allowExtracts
        fileUploads
        environmentId={environmentId}
      />
    </>
  );
}
