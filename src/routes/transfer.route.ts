import express from "express";
import { authMiddleware } from "@ph-deped-ncr/utils";
import { ACCESS_TOKEN_SECRET } from "./../config";
import useTransferController from "./../controllers/transfer.controller";

const { createTransfer, getTransfers, getTransferById, approveStatus, completeStatus } = useTransferController();

const router = express.Router();

const accessTokenSecret = ACCESS_TOKEN_SECRET;
const auth = authMiddleware(accessTokenSecret);

router.post("/", auth, createTransfer);
router.get("/:type", auth, getTransfers);
router.get("/id/:id", auth, getTransferById);
router.put("/id/:id/approved", auth, approveStatus);
router.put("/id/:id/completed", auth, completeStatus);

export default router;
