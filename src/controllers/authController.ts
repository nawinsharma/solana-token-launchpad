import { Request, Response } from "express";
import { z } from "zod";
import { loginUser, registerUser } from "../services/authService";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function register(req: Request, res: Response) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: parsed.error.flatten(),
      });
    }

    const { email, password, name } = parsed.data;
    const result = await registerUser(email, password, name);

    if (result.kind === "email_exists") {
      return res.status(409).json({ error: "Email already registered" });
    }

    return res.status(201).json(result);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: parsed.error.flatten(),
      });
    }

    const { email, password } = parsed.data;
    const result = await loginUser(email, password);

    if (result.kind === "invalid_credentials") {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    return res.status(200).json(result);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

