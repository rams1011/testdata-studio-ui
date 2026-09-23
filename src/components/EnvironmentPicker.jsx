import ItemPicker from "./ItemPicker";

export default function EnvironmentPicker(props) {
  return (
    <ItemPicker
      items={props.environments}
      selectedId={props.selectedId}
      triggerId="environment-select"
      ariaLabel="Environments"
      emptyTrigger="No environment"
      emptyList="No environments yet"
      newLabel="New environment…"
      onSelect={props.onSelect}
      onEdit={props.onEdit}
      onDelete={props.onDelete}
      onCreate={props.onCreate}
    />
  );
}
