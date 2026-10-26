import { Request, Response, CookieOptions } from "express";
import { envConfig } from "../config/env.config.js";

// DEF-SEG-FE-02: la sesión del navegador viaja en una cookie HttpOnly (ningún script la puede leer).
export const SESSION_COOKIE = "homara_session";

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // igual que el `expiresIn: "7d"` del JWT

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: envConfig.nodeEnv === "production",
    sameSite: "strict", // el navegador no la envía desde otro sitio: cierra el CSRF
    path: "/",
  };
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_MAX_AGE_MS });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export function readSessionCookie(req: Request): string | undefined {
  for (const pair of req.headers.cookie?.split(";") ?? []) {
    const [name, ...value] = pair.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(value.join("="));
  }
  return undefined;
}
