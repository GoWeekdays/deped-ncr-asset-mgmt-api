import express from "express";
import { authMiddleware } from "@ph-deped-ncr/utils";
import { ACCESS_TOKEN_SECRET } from "./../config";
import useReturnController from "./../controllers/return.controller";
import useAssetController from "./../controllers/asset.controller";

const { createReturn, getReturns, getReturnById, approveStatus, completeStatus } = useReturnController();
const { getAssetsForDisposalReport } = useAssetController();

const router = express.Router();

const accessTokenSecret = ACCESS_TOKEN_SECRET;
const auth = authMiddleware(accessTokenSecret);

router.post("/", auth, createReturn);
router.get("/type/:type", auth, getReturns);
router.get("/id/:id", auth, getReturnById);
router.put("/id/:id/approved", auth, approveStatus);
router.put("/id/:id/completed", auth, completeStatus);
router.get("/report/for-disposal/:type", auth, getAssetsForDisposalReport);

export default router;
