import express from "express";
import { authMiddleware } from "@ph-deped-ncr/utils";
import { ACCESS_TOKEN_SECRET } from "./../config";
import useDashboardController from "./../controllers/dashboard.controller";

const { getAssetsOverview, getAssetTypesOverview, getPropertyConditions, getRecentActivities } = useDashboardController();

const router = express.Router();

const accessTokenSecret = ACCESS_TOKEN_SECRET;
const auth = authMiddleware(accessTokenSecret);

router.get("/assets-overview", auth, getAssetsOverview);
router.get("/asset-types", auth, getAssetTypesOverview);
router.get("/property-conditions", auth, getPropertyConditions);
router.get("/recent-activities", auth, getRecentActivities);

export default router;
