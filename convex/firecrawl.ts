"use node";
import Firecrawl from "@mendable/firecrawl-js";

const apiKey = process.env.FIRECRAWL_API_KEY;
if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not set");
export const firecrawl = new Firecrawl({ apiKey });