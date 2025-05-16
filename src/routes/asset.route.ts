import express from "express";
import { authMiddleware } from "@ph-deped-ncr/utils";
import { ACCESS_TOKEN_SECRET } from "./../config";
import useAssetController from "./../controllers/asset.controller";

const {
  createConsumable,
  createProperty,
  getAssets,
  getAssetsForTransfer,
  getAssetsForReturn,
  getAssetById,
  getAssetsForWaste,
  getAssetsForMaintenance,
  getAssetConsumables,
  getAssetSEPPPE,
  updateAssetById,
  updatePropertyById,
  deleteAssetById,
} = useAssetController();

const router = express.Router();

const accessTokenSecret = ACCESS_TOKEN_SECRET;
const auth = authMiddleware(accessTokenSecret);

router.post("/consumable", auth, createConsumable);
router.post("/properties", auth, createProperty);
router.put("/properties", auth, updatePropertyById);
router.get("/print/consumables", auth, getAssetConsumables);
router.get("/print/:type", auth, getAssetSEPPPE);
router.get("/:type", auth, getAssets);
router.get("/transfer/:type", auth, getAssetsForTransfer);
router.get("/return/:type", auth, getAssetsForReturn);
router.get("/wastes/asset-condition", auth, getAssetsForWaste);
router.get("/maintenances/asset-condition", auth, getAssetsForMaintenance);
router.get("/id/:id", auth, getAssetById);
router.put("/id/:id", auth, updateAssetById);
router.delete("/id/:id", auth, deleteAssetById);

export default router;
