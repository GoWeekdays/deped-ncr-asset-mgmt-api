import express from "express";

const router = express.Router();

import { useAuthController } from "./../controllers/auth.controller";

const { login, logout, refreshToken, resetPassword } = useAuthController();

router.post("/login", login);
router.delete("/logout/:id", logout);
router.post("/refresh", refreshToken);

import { useOTPController } from "./../controllers/otp.controller";

const { generateForgetPasswordOTP, verifyOTP } = useOTPController();

router.post("/forget-password", generateForgetPasswordOTP);

router.post("/verify-otp", verifyOTP);
router.post("/reset-password", resetPassword);

export default router;
