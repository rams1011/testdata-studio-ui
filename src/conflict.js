export async function resolveWriteConflict(error, {
  onReload,
  onOverwrite,
  overwritePrompt = "Overwrite the server version with your changes?"
} = {}) {
  if (error?.status !== 409) {
    throw error;
  }
  const message = error.message || "Someone else saved a newer version.";
  if (window.confirm(`${message}\n\nLoad the server copy now?`)) {
    if (error.body?.current) {
      await onReload(error.body.current);
    }
    return "reload";
  }
  if (!window.confirm(overwritePrompt)) {
    return "cancel";
  }
  await onOverwrite();
  return "overwrite";
}
