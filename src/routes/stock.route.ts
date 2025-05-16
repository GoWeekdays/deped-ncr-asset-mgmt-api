import express from "express";
import { authMiddleware } from "@ph-deped-ncr/utils";
import { ACCESS_TOKEN_SECRET } from "./../config";
import useStockController from "./../controllers/stock.controller";

const {
  createStock,
  createStockByBatch,
  getStockById,
  getStocksByAssetId,
  getStocksByCondition,
  getReissuedStocksForLoss,
  getReissuedStocksForReturn,
  getPropertyByOfficeId,
  getPersonnelStockCardById,
} = useStockController();

const router = express.Router();

const auth = authMiddleware(ACCESS_TOKEN_SECRET);

router.post("/", auth, createStock);
router.get("/asset/:asset", auth, getStocksByAssetId);
router.get("/personnel-stock-card/:userId", auth, getPersonnelStockCardById);
router.post("/batch", auth, createStockByBatch);
router.get("/property/:officeId", auth, getPropertyByOfficeId);
router.get("/id/:id", auth, getStockById);
router.get("/asset/:asset", auth, getStocksByAssetId);
router.get("/condition/:condition/:asset", auth, getStocksByCondition);
router.get("/loss/reissued/:issueSlipId", auth, getReissuedStocksForLoss);
router.get("/return/reissued/:assetId", auth, getReissuedStocksForReturn);

export default router;
