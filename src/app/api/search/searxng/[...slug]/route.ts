import { NextResponse, type NextRequest } from "next/server";
import { SEARXNG_BASE_URL } from "@/constants/urls";

const API_PROXY_BASE_URL = process.env.SEARXNG_API_BASE_URL || SEARXNG_BASE_URL;

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

  try {
    let url = `${API_PROXY_BASE_URL}/${decodeURIComponent(path.join("/"))}`;
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
