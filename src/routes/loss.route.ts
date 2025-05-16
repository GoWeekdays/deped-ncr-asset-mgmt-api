import express from "express";
import { authMiddleware } from "@ph-deped-ncr/utils";
import { ACCESS_TOKEN_SECRET } from "./../config";
import useAssetController from "./../controllers/loss.controller";

const { createLoss, getLosses, getLossById, updateStatusToApproved, updateStatusToCompleted } = useAssetController();

const router = express.Router();

const accessTokenSecret = ACCESS_TOKEN_SECRET;
const auth = authMiddleware(accessTokenSecret);

router.post("/", auth, createLoss);
router.get("/type/:type/:status", auth, getLosses);
router.get("/id/:id", auth, getLossById);
router.put("/approved/:id", auth, updateStatusToApproved);
router.put("/completed/:id", auth, updateStatusToCompleted);

export default router;
