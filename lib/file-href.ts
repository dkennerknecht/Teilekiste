export function fileHref(absolutePath: string) {
  const encoded = absolutePath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `/api/files/${encoded}`;
}
