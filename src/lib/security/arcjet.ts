import arcjet, { fixedWindow, shield } from "@arcjet/next";

// Stricter rate limit for bid submissions (10 req/min per IP)
export const bidRateLimit = arcjet({
  key: process.env.ARCJET_KEY!,
  characteristics: ["ip.src"],
  rules: [
    shield({ mode: "LIVE" }),
    fixedWindow({
      mode: "LIVE",
      window: "60s",
      max: 10,
    }),
  ],
});

// Standard rate limit for checkout (5 req/min per IP)
export const checkoutRateLimit = arcjet({
  key: process.env.ARCJET_KEY!,
  characteristics: ["ip.src"],
  rules: [
    shield({ mode: "LIVE" }),
    fixedWindow({
      mode: "LIVE",
      window: "60s",
      max: 5,
    }),
  ],
});

// Message sending rate limit (20 req/min per IP)
export const messageRateLimit = arcjet({
  key: process.env.ARCJET_KEY!,
  characteristics: ["ip.src"],
  rules: [
    shield({ mode: "LIVE" }),
    fixedWindow({
      mode: "LIVE",
      window: "60s",
      max: 20,
    }),
  ],
});
