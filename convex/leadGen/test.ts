"use node";

import { action } from "../_generated/server";
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

export const searchPlacesText = action({
  args: {
    textQuery: v.string() ?? "roofers in San Francisco",
    maxResultCount: v.optional(v.number()) ?? 20,
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
  }),
  handler: async (ctx, args) => {
    const placesClient = new PlacesClient({
      apiKey: process.env.GOOGLE_PLACES_API_KEY,
    });

    const request: {
      textQuery: string;
      maxResultCount: number;
    } = {
      textQuery: args.textQuery,
      maxResultCount: Math.min(args.maxResultCount ?? 20, 20),
    };

    // Note: Field mask doesn't work with this Node.js client library,
    // but Google bills based on fields used in code, not fields returned
    const options = {
      otherArgs: {
        headers: {
          "X-Goog-FieldMask": FIELD_MASK.join(","),
        },
      },
    };

    console.log('Request:', JSON.stringify(request, null, 2));

    const rawResponse = await placesClient.searchText(request, options);
    const [searchResponse] = rawResponse;
    console.log(`Received ${searchResponse.places?.length} places`);
    const response: unknown = Array.isArray(rawResponse) ? rawResponse[0] : rawResponse;

    type ApiPlace = {
      id?: string;
      displayName?: { text?: string; languageCode?: string };
      websiteUri?: string;
      internationalPhoneNumber?: string;
      rating?: number;
      userRatingCount?: number;
      formattedAddress?: string;
    };
    const respObj = (response as { places?: Array<ApiPlace>; }) ?? {};
    const places = (respObj.places ?? []).map((p: ApiPlace) => {
      // Handle the nested displayName structure
      const name = p?.displayName?.text ?? "";
      return {
        id: p?.id ?? "",
        name,
        website: p?.websiteUri ?? undefined,
        phone: p?.internationalPhoneNumber ?? undefined,
        rating: p?.rating ?? undefined,
        reviews: p?.userRatingCount ?? undefined,
        address: p?.formattedAddress ?? undefined,
      };
    });
    console.log(places)
    return {
      places,
    };
  },
});