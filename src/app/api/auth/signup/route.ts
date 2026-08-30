import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "invalid_email", message: "Enter a valid email." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: "weak_password", message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }
  if (!name) {
    return NextResponse.json({ error: "missing_name", message: "Enter your name." }, { status: 400 });
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) {
    return NextResponse.json(
      { error: "email_taken", message: "An account with that email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  // The diner row is created lazily on this account's first sign-in (see
  // src/server/identity.ts) — this route only ever creates the user.
  await db.insert(users).values({ email, name, passwordHash });

  return NextResponse.json({ ok: true });
}
