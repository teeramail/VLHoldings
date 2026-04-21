export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileUrl = searchParams.get("url");
  const filename = searchParams.get("filename") ?? "download";

  if (!fileUrl) {
    return new Response("Missing url parameter", { status: 400 });
  }

  try {
    const upstream = await fetch(fileUrl);
    if (!upstream.ok) {
      return new Response("Failed to fetch file", { status: upstream.status });
    }

    const contentType =
      upstream.headers.get("content-type") ?? "application/octet-stream";

    const safeFilename = filename.replace(/[^\w.\- ]/g, "_");

    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Download failed", { status: 500 });
  }
}
