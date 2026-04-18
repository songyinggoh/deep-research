import { NextResponse, type NextRequest } from "next/server";
import { SEARXNG_BASE_URL } from "@/constants/urls";

const API_PROXY_BASE_URL = process.env.SEARXNG_API_BASE_URL || SEARXNG_BASE_URL;

const ALLOWED_PATHS = new Set(["search"]);

export async function POST(req: NextRequest) {
  let body;
  if (req.method.toUpperCase() !== "GET") {
    try {
      body = await req.json();
    } catch {
      // no body or non-JSON body — query params carry the search params
    }
  }
  const searchParams = req.nextUrl.searchParams;
  const path = searchParams.getAll("slug");
  searchParams.delete("slug");
  const params = searchParams.toString();

  const decodedSegments = path.map((seg) => {
    try {
      return decodeURIComponent(seg);
    } catch {
      return seg;
    }
  });

  // Reject path traversal and empty segments before the URL layer can collapse them.
  const hasTraversal = decodedSegments.some(
    (seg) => seg === "" || seg === "." || seg === ".." || seg.includes("/") || seg.includes("\\")
  );
  if (hasTraversal || decodedSegments.length === 0 || !ALLOWED_PATHS.has(decodedSegments[0])) {
    return NextResponse.json(
      { code: 400, message: "Path not allowed" },
      { status: 400 }
    );
  }

  try {
    let url = `${API_PROXY_BASE_URL}/${decodedSegments.join("/")}`;
    if (params) url += `?${params}`;
    const payload: RequestInit = {
      method: req.method,
      headers: {
        "Content-Type": req.headers.get("Content-Type") || "application/json",
      },
    };
    if (body) payload.body = JSON.stringify(body);
    const response = await fetch(url, payload);
    return new NextResponse(response.body, response);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return NextResponse.json(
        { code: 500, message: error.message },
        { status: 500 }
      );
    }
  }
}
