import SchemaBodyEditor from "./SchemaBodyEditor";
import { sampleFromSchema } from "../schema";

export default function RequestBodyEditor({ schema, value, onChange, resetKey, caseId, onEnsureCase }) {
  return (
    <SchemaBodyEditor
      schema={schema}
      value={value}
      onChange={onChange}
      resetKey={resetKey}
      caseId={caseId}
      onEnsureCase={onEnsureCase}
      searchAria="Search request body fields"
      jsonAria="Request body JSON"
      tabsAria="Request body editor"
      onFillSample={() => onChange(sampleFromSchema(schema))}
    />
  );
}
