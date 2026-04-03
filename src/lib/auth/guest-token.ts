import { SignJWT, jwtVerify, errors } from "jose";

export interface GuestTokenPayload {
  transaction_id: string;
  buyer_email: string;
  role: "buyer";
}

const ALGORITHM = "HS256";
const EXPIRATION = "30d"; // matches escrow window

function getSecret(): Uint8Array {
  const secret = process.env.GUEST_TOKEN_SECRET;
  if (!secret) {
    throw new Error("GUEST_TOKEN_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Sign a guest buyer JWT — issued at checkout completion.
 * Contains transaction_id + buyer_email, expires in 30 days.
 */
export async function signGuestToken(
  payload: Omit<GuestTokenPayload, "role">,
): Promise<string> {
  return new SignJWT({ ...payload, role: "buyer" as const })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(EXPIRATION)
    .sign(getSecret());
}

/**
 * Verify and decode a guest buyer JWT.
 * Returns null if invalid/expired (never throws to callers).
 */
export async function verifyGuestToken(
  token: string,
): Promise<GuestTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const { transaction_id, buyer_email, role } = payload as unknown as GuestTokenPayload;

    if (!transaction_id || !buyer_email || role !== "buyer") {
      return null;
    }

    return { transaction_id, buyer_email, role };
  } catch (err) {
    if (err instanceof errors.JWTExpired) {
      console.warn("Guest token expired");
    }
    return null;
  }
}

/**
 * Extract guest token from request — checks Authorization header first,
 * then falls back to ?token= query param.
 */
export function extractGuestToken(request: Request): string | null {
  // Check Authorization: Bearer <token>
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Check query param
  const url = new URL(request.url);
  return url.searchParams.get("token");
}

/**
 * Authenticate a request as either a Supabase user (seller) or guest buyer.
 * Returns the identity with role context.
 */
export interface AuthIdentity {
  role: "seller" | "buyer";
  userId?: string; // present for authenticated sellers
  email?: string; // present for guest buyers
  transactionId?: string; // present for guest buyers (scoped access)
}

export async function authenticateRequest(
  request: Request,
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
): Promise<AuthIdentity | null> {
  // Try Supabase auth first (seller)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return { role: "seller", userId: user.id };
  }

  // Try guest token (buyer)
  const token = extractGuestToken(request);
  if (token) {
    const payload = await verifyGuestToken(token);
    if (payload) {
      return {
        role: "buyer",
        email: payload.buyer_email,
        transactionId: payload.transaction_id,
      };
    }
  }

  return null;
}
