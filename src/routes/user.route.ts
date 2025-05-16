import express from "express";

const router = express.Router();

import { useUserController } from "./../controllers/user.controller";

const { getUsers, getUsersByType, getUserById, createUserWithInvite, updateUser, suspendUser, deleteUser, updatePassword, getPersonnelList } =
  useUserController();

import { authMiddleware } from "@ph-deped-ncr/utils";
import { ACCESS_TOKEN_SECRET } from "./../config";

const accessTokenSecret = ACCESS_TOKEN_SECRET;

const auth = authMiddleware(accessTokenSecret);

router.get("/", auth, getUsers);
router.get("/personnel", auth, getPersonnelList);
router.get("/role/:type", auth, getUsersByType);
router.get("/:id", auth, getUserById);
router.put("/:id", auth, updateUser);
router.put("/status/suspended/:id", auth, suspendUser);
router.delete("/:id", auth, deleteUser);

import { useOTPController } from "./../controllers/otp.controller";

const { generateUserInviteOTP, generateUpdateEmailOTP, getOTPByType, cancelUserInviteOTP, verifyOTPBySixDigits } = useOTPController();

router.post("/user-invite", auth, generateUserInviteOTP);
router.post("/user-invite/accepted", createUserWithInvite);
router.put("/user-invite/cancelled/:id", auth, cancelUserInviteOTP);

router.get("/otp-type/:type", auth, getOTPByType); // values: forget-password, user-invite, update-email

router.post("/email-otp", auth, generateUpdateEmailOTP);
router.post("/verify-otp/:id", auth, verifyOTPBySixDigits);
router.put("/update-password/:id", auth, updatePassword);

export default router;
