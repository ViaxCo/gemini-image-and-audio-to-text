export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function mirrorFileListToInput(
  input: HTMLInputElement,
  files: FileList | File[] | null,
) {
  try {
    const dt = new DataTransfer();
    for (const f of files ? Array.from(files) : []) {
      dt.items.add(f);
    }
    (input as unknown as { files: FileList }).files = dt.files;
  } catch {
    // Some browsers may disallow programmatic assignment; ignore.
  }
}
