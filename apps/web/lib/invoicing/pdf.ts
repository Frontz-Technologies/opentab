const GOTENBERG_URL = process.env.GOTENBERG_URL ?? "http://gotenberg:3000";

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const formData = new FormData();

  const htmlBlob = new Blob([html], { type: "text/html" });
  formData.append("files", htmlBlob, "index.html");

  formData.append("marginTop", "0.5");
  formData.append("marginBottom", "0.5");
  formData.append("marginLeft", "0.5");
  formData.append("marginRight", "0.5");
  formData.append("paperWidth", "8.27");
  formData.append("paperHeight", "11.69");

  const response = await fetch(`${GOTENBERG_URL}/forms/chromium/convert/html`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(
      `Gotenberg error: ${response.status} ${response.statusText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
