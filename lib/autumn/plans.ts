export type Plan = {
  id: "free" | "pro" | "business";
  name: string;
  productId?: string;
  price: string;
  includedCredits: string;
  perks: Array<string>;
};

export const PLANS: Array<Plan> = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    includedCredits: "15 one-time credits",
    perks: ["Get started for free"],
  },
  {
    id: "pro",
    name: "Pro",
    productId: "pro",
    price: "$49/mo",
    includedCredits: "100 credits / month",
    perks: ["For growing teams"],
  },
  {
    id: "business",
    name: "Business",
    productId: "business",
    price: "$199/mo",
    includedCredits: "500 credits / month",
    perks: ["Priority support"],
  },
];


