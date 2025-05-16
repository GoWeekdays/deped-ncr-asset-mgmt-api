import express from "express";
import { authMiddleware } from "@ph-deped-ncr/utils";
import { ACCESS_TOKEN_SECRET } from "./../config";
import useRISlipController from "./../controllers/ris.controller";

const {
  createRISlip,
  cancelRISlipById,
  evaluateRISlipById,
  getRISlips,
  getReportRISlips,
  getRISlipById,
  getReportRISlipById,
  approveRISlipById,
  issueRISlipById,
  updateRISlipStatusById,
  incrementSerialNoCounter,
} = useRISlipController();

const router = express.Router();

const accessTokenSecret = ACCESS_TOKEN_SECRET;
const auth = authMiddleware(accessTokenSecret);

router.post("/", auth, createRISlip);
router.get("/", auth, getRISlips);
router.get("/id/:id", auth, getRISlipById);
router.put("/id/:id/:status", auth, updateRISlipStatusById);
router.put("/evaluating/:id", auth, evaluateRISlipById);
router.put("/cancelled/:id", auth, cancelRISlipById);
router.put("/pending/:id", auth, approveRISlipById);
router.put("/issued/:id", auth, issueRISlipById);

router.get("/report", auth, getReportRISlips);
router.get("/report/:id", auth, getReportRISlipById);
router.put("/report/serial-no/:id", auth, incrementSerialNoCounter);

export default router;
