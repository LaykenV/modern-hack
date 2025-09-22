"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { PlacesClient } from "@googlemaps/places";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.websiteUri",
  "places.internationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.formattedAddress",
];

/**
 * Internal action to source leads from Google Places API
 * Reuses the existing Places implementation with enhanced error handling and retries
 */
export const sourcePlaces = internalAction({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
    textQuery: v.string(),
    maxResultCount: v.number(),
  },
  returns: v.object({
    places: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        website: v.optional(v.string()),
        phone: v.optional(v.string()),
        rating: v.optional(v.number()),
        reviews: v.optional(v.number()),
        address: v.optional(v.string()),
      })
    ),
    numFetched: v.number(),
  }),
  handler: async (ctx, args) => {
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      throw new Error("Google Places API key not configured");
    }

    const placesClient = new PlacesClient({
      apiKey: process.env.GOOGLE_PLACES_API_KEY,
    });

    const request = {
      textQuery: args.textQuery,
      maxResultCount: Math.min(args.maxResultCount, 20), // Clamp to max 20
    };

    const options = {
      otherArgs: {
        headers: {
          "X-Goog-FieldMask": FIELD_MASK.join(","),
        },
      },
    };

    console.log(`[Lead Gen] Sourcing places for query: "${args.textQuery}"`);

    try {
      const rawResponse = await placesClient.searchText(request, options);
      const [searchResponse] = rawResponse;
      
      console.log(`[Lead Gen] Received ${searchResponse.places?.length || 0} places from Google Places API`);

      type ApiPlace = {
        id?: string;
        displayName?: { text?: string; languageCode?: string };
        websiteUri?: string;
        internationalPhoneNumber?: string;
        rating?: number;
        userRatingCount?: number;
        formattedAddress?: string;
      };

      const response: unknown = Array.isArray(rawResponse) ? rawResponse[0] : rawResponse;
      const respObj = (response as { places?: Array<ApiPlace> }) ?? {};
      const rawPlaces = respObj.places ?? [];

      // Transform and normalize the places data
      const places = rawPlaces.map((p: ApiPlace) => {
        const name = p?.displayName?.text ?? "";
        const website = p?.websiteUri ? normalizeWebsite(p.websiteUri) : undefined;
        const phone = p?.internationalPhoneNumber ? normalizePhone(p.internationalPhoneNumber) : undefined;
        
        return {
          id: p?.id ?? "",
          name,
          website,
          phone,
          rating: p?.rating ?? undefined,
          reviews: p?.userRatingCount ?? undefined,
          address: p?.formattedAddress ?? undefined,
        };
      });

      // Deduplication by Google ID and canonical website domain
      const deduplicatedPlaces = deduplicatePlaces(places);
      
      console.log(`[Lead Gen] After deduplication: ${deduplicatedPlaces.length} unique places`);

      return {
        places: deduplicatedPlaces,
        numFetched: deduplicatedPlaces.length,
      };
    } catch (error) {
      console.error("[Lead Gen] Google Places API error:", error);
      throw new Error(`Google Places API failed: ${String(error)}`);
    }
  },
});

/**
 * Normalize website URL to a canonical format
 */
function normalizeWebsite(website: string): string | undefined {
  if (!website) return undefined;
  
  try {
    // Add protocol if missing
    let url = website.toLowerCase().trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    const urlObj = new URL(url);
    
    // Remove www. prefix for consistency
    let hostname = urlObj.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    
    // Return clean URL
    return `https://${hostname}${urlObj.pathname === '/' ? '' : urlObj.pathname}`;
  } catch {
    // If URL parsing fails, return original
    return website;
  }
}

/**
 * Normalize phone number (basic normalization)
 */
function normalizePhone(phone: string): string | undefined {
  if (!phone) return undefined;
  
  // Remove common formatting characters but keep the core number
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  return cleaned.length > 5 ? phone : undefined; // Return original format if valid
}

/**
 * Deduplicate places by Google ID and canonical website domain
 */
function deduplicatePlaces(places: Array<{
  id: string;
  name: string;
  website?: string;
  phone?: string;
  rating?: number;
  reviews?: number;
  address?: string;
}>) {
  const seenIds = new Set<string>();
  const seenDomains = new Set<string>();
  const deduplicated: Array<typeof places[number]> = [];

  for (const place of places) {
    const idKey = place.id || "";
    let domainKey: string | undefined;
    if (place.website) {
      try {
        domainKey = new URL(place.website).hostname.replace(/^www\./, "");
      } catch {
        domainKey = undefined;
      }
    }

    const isDuplicateById = idKey !== "" && seenIds.has(idKey);
    const isDuplicateByDomain = domainKey ? seenDomains.has(domainKey) : false;

    if (isDuplicateById || isDuplicateByDomain) {
      continue;
    }

    if (idKey !== "") seenIds.add(idKey);
    if (domainKey) seenDomains.add(domainKey);
    deduplicated.push(place);
  }

  return deduplicated;
}

