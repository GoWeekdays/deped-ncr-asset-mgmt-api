import express from "express";
import { authMiddleware } from "@ph-deped-ncr/utils";
import { ACCESS_TOKEN_SECRET } from "./../config";
import useWasteController from "./../controllers/waste.controller";
import useStockController from "./../controllers/stock.controller";

const { createWaste, getWastes, getWasteById, updateWasteById } = useWasteController();
const { getStocksByWasteCondition } = useStockController();

const router = express.Router();
const accessTokenSecret = ACCESS_TOKEN_SECRET;
const auth = authMiddleware(accessTokenSecret);

router.post("/", auth, createWaste);
router.get("/", auth, getWastes);
router.get("/condition/:condition/:assetId", auth, getStocksByWasteCondition);
router.get("/:id", auth, getWasteById);
router.put("/:id", auth, updateWasteById);

export default router;
