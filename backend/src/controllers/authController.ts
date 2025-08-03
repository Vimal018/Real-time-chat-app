// authController.ts
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { signupSchema, loginSchema } from "../validators/userValidator";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;



const generateAccessToken = (userId: string) =>
  jwt.sign({ id: userId }, JWT_ACCESS_SECRET, { expiresIn: "1h" });

const generateRefreshToken = (userId: string) =>
  jwt.sign({ id: userId }, JWT_REFRESH_SECRET, { expiresIn: "7d" });

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const registerUser = async (req: Request, res: Response) => {
  console.log("JWT_ACCESS_SECRET in authController:", JWT_ACCESS_SECRET);
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

    const { name, email, password } = parsed.data;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ name, email, password: hashedPassword });

    const accessToken = generateAccessToken(newUser._id.toString());
    const refreshToken = generateRefreshToken(newUser._id.toString());

    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      token: accessToken,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  console.log("JWT_ACCESS_SECRET in authController:", JWT_ACCESS_SECRET);
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

    const { email, password } = parsed.data;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    setRefreshCookie(res, refreshToken);

    res.status(200).json({
      token: accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// Rest of the code...

// ---------------------------------------------
// POST /api/auth/refresh-token
export const refreshAccessToken = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.refresh_token;
    if (!token) return res.status(401).json({ message: "No refresh token" });

    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as { id: string };

    const newAccessToken = generateAccessToken(decoded.id);
    const newRefreshToken = generateRefreshToken(decoded.id);

    setRefreshCookie(res, newRefreshToken);

    res.json({ token: newAccessToken });
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired refresh token" });
  }
};

// ---------------------------------------------

// POST /api/auth/logout
export const logoutUser = (req: Request, res: Response) => {
  res.clearCookie("refresh_token", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });

  res.status(200).json({ message: "Logged out successfully" });
};
