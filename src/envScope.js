export function visibleInEnvironment(names, envName) {
  if (!names || !names.length) {
    return true;
  }
  if (!envName) {
    return true;
  }
  const needle = String(envName).trim().toLowerCase();
  return names.some((name) => name && String(name).trim().toLowerCase() === needle);
}

export function environmentLabel(names) {
  if (!names || !names.length) {
    return "all environments";
  }
  return names.join(", ");
}
