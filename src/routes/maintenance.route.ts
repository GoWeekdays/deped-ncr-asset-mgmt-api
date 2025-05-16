import express from "express";
import { authMiddleware } from "@ph-deped-ncr/utils";
import { ACCESS_TOKEN_SECRET } from "./../config";
import useMaintenanceController from "./../controllers/maintenance.controller";
import useStockController from "./../controllers/stock.controller";

const {
  createMaintenance,
  getMaintenances,
  getMaintenanceById,
  updateMaintenanceById,
  cancelStatus,
  scheduleStatus,
  rescheduleStatus,
  completeStatus,
} = useMaintenanceController();

const { getReissuedStocksForMaintenance } = useStockController();

const router = express.Router();

const accessTokenSecret = ACCESS_TOKEN_SECRET;
const auth = authMiddleware(accessTokenSecret);

router.post("/", auth, createMaintenance);
router.get("/", auth, getMaintenances);
router.get("/:id", auth, getMaintenanceById);
router.get("/item-no/:assetId", auth, getReissuedStocksForMaintenance);
router.put("/cancelled/:id", auth, cancelStatus);
router.put("/scheduled/:id", auth, scheduleStatus);
router.put("/rescheduled/:id", auth, rescheduleStatus);
router.put("/completed/:id", auth, completeStatus);
router.put("/:id", auth, updateMaintenanceById);

export default router;
