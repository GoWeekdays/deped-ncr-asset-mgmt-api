import express from "express";
import { authMiddleware } from "@ph-deped-ncr/utils";
import { ACCESS_TOKEN_SECRET } from "./../config";
import useAssetCodeController from "./../controllers/asset-code.controller";

const { createAssetCode, getAssetCodesByType, updateAssetCodeById, deleteAssetCode } = useAssetCodeController();

const router = express.Router();

const accessTokenSecret = ACCESS_TOKEN_SECRET;
const auth = authMiddleware(accessTokenSecret);

router.post("/", auth, createAssetCode);
router.get("/:type", auth, getAssetCodesByType);
router.put("/:id", auth, updateAssetCodeById);
router.delete("/:id", auth, deleteAssetCode);

export default router;
