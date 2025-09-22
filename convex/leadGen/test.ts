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
  "nextPageToken",
];

export const searchPlacesText = action({
  args: {
    textQuery: v.string() ?? "roofers in San Francisco",
    maxResultCount: v.optional(v.number()) ?? 100,
    pageToken: v.optional(v.string()) ?? undefined,
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
    nextPageToken: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const placesClient = new PlacesClient({
      apiKey: process.env.GOOGLE_PLACES_API_KEY,
    });

    const request: {
      textQuery: string;
      maxResultCount: number;
      pageToken?: string;
    } = {
      textQuery: args.textQuery,
      maxResultCount: args.maxResultCount ?? 100,
      pageToken: args.pageToken,
    };

    const options = {
      otherArgs: {
        headers: {
          "X-Goog-FieldMask": FIELD_MASK.join(","),
        },
      },
    } as const;

    const rawResponse = await placesClient.searchText(request, options);
    const [searchResponse] = rawResponse;
    console.log(searchResponse.places?.length);
    console.log(searchResponse);
    const response: unknown = Array.isArray(rawResponse) ? rawResponse[0] : rawResponse;

    type ApiPlace = {
      id?: string;
      displayName?: { text?: string } | string;
      websiteUri?: string;
      internationalPhoneNumber?: string;
      rating?: number;
      userRatingCount?: number;
      formattedAddress?: string;
    };
    const respObj = (response as { places?: Array<ApiPlace>; nextPageToken?: string }) ?? {};
    const places = (respObj.places ?? []).map((p: ApiPlace) => {
      const displayName = p?.displayName;
      const name = typeof displayName === "object" ? displayName?.text ?? "" : displayName ?? "";
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

    return {
      places,
      nextPageToken: respObj?.nextPageToken ?? undefined,
    };
  },
});