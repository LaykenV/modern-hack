import { createAuth } from "@/convex/auth";
import { getToken as getTokenNextjs } from "@convex-dev/better-auth/nextjs";
import { type GenericCtx } from "@convex-dev/better-auth";
import { type DataModel } from "@/convex/_generated/dataModel";

export const getServerToken = () => {
  return getTokenNextjs(() => createAuth({} as GenericCtx<DataModel>, { optionsOnly: true }));
};