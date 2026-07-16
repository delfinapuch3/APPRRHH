import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import type { Request } from "express";
import { signToken, requireAdmin, sectorScope, type AuthUser } from "./auth.js";

describe("signToken", () => {
  it("firma un token cuyo sub es el userId", () => {
    const token = signToken("user-123");
    const payload = jwt.decode(token) as { sub: string; exp: number };
    expect(payload.sub).toBe("user-123");
  });

  it("el token tiene expiración (12h)", () => {
    const token = signToken("user-123");
    const { iat, exp } = jwt.decode(token) as { iat: number; exp: number };
    expect(exp - iat).toBe(12 * 60 * 60);
  });
});

function fakeReqRes(user?: AuthUser) {
  const req = { user } as Request;
  let statusCode = 200;
  let body: unknown = null;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  };
  return { req, res, get statusCode() { return statusCode; }, get body() { return body; } };
}

describe("requireAdmin", () => {
  it("deja pasar a un ADMIN", () => {
    const ctx = fakeReqRes({ id: "1", email: "a@a.com", nombre: "A", role: "ADMIN", sectorIds: [] });
    let llamado = false;
    requireAdmin(ctx.req, ctx.res as never, () => { llamado = true; });
    expect(llamado).toBe(true);
  });

  it("bloquea a un ENCARGADO con 403", () => {
    const ctx = fakeReqRes({ id: "2", email: "b@b.com", nombre: "B", role: "ENCARGADO", sectorIds: [] });
    let llamado = false;
    requireAdmin(ctx.req, ctx.res as never, () => { llamado = true; });
    expect(llamado).toBe(false);
    expect(ctx.statusCode).toBe(403);
  });
});

describe("sectorScope", () => {
  it("un ADMIN no tiene restricción de sector (null)", () => {
    const req = { user: { id: "1", email: "a", nombre: "A", role: "ADMIN", sectorIds: ["x"] } } as Request;
    expect(sectorScope(req)).toBeNull();
  });

  it("un ENCARGADO queda limitado a sus sectores", () => {
    const req = { user: { id: "2", email: "b", nombre: "B", role: "ENCARGADO", sectorIds: ["s1", "s2"] } } as Request;
    expect(sectorScope(req)).toEqual(["s1", "s2"]);
  });
});
