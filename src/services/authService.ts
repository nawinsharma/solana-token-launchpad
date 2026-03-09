import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../prisma";
import { JWT_SECRET } from "../config";

export async function registerUser(
  email: string,
  password: string,
  name: string,
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { kind: "email_exists" as const };
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hashed, name },
  });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET);
  return {
    kind: "ok" as const,
    token,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { kind: "invalid_credentials" as const };
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return { kind: "invalid_credentials" as const };
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET);
  return {
    kind: "ok" as const,
    token,
    user: { id: user.id, email: user.email, name: user.name },
  };
}
