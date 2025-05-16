import express from "express";
import { authMiddleware } from "@ph-deped-ncr/utils";
import { ACCESS_TOKEN_SECRET } from "./../config";
import useIssueSlipController from "./../controllers/issue-slip.controller";

const { createIssueSlip, getIssueSlips, getIssueSlipsByReceiver, getIssueSlipById, updateStatusToIssued } = useIssueSlipController();

const router = express.Router();

const auth = authMiddleware(ACCESS_TOKEN_SECRET);

router.post("/", auth, createIssueSlip);
router.get("/:type", auth, getIssueSlips);
router.get("/receiver/:type", auth, getIssueSlipsByReceiver);
router.get("/id/:id", auth, getIssueSlipById);
router.put("/id/:id", auth, updateStatusToIssued);

export default router;
