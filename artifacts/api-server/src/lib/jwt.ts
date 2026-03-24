import jwt from "jsonwebtoken";

export interface JwtPayload {
  sub: number;          // residentId
  role: "resident" | "committee" | "admin";
  name: string;
  flatNumber: string | null;
  email: string;
}

const JWT_SECRET = process.env.JWT_SECRET ?? "psots-dev-secret-change-in-production";

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
