import express from "express";

const router = express.Router();

router.get("/v1", (_, res) => {
  res.json({
    message: "Welcome to my API",
  });
});

import auth from "./auth.route";
router.use("/auth", auth);

import user from "./user.route";
router.use("/users", user);

import file from "./file.route";
router.use("/files", file);

import asset from "./asset.route";
router.use("/assets", asset);

import assetCode from "./asset-code.route";
router.use("/asset-codes", assetCode);

import stock from "./stock.route";
router.use("/stocks", stock);

import ris from "./ris.route";
router.use("/ris", ris);

import issueSlip from "./issue-slip.route";
router.use("/issue-slips", issueSlip);

import transfer from "./transfer.route";
router.use("/transfers", transfer);

import loss from "./loss.route";
router.use("/losses", loss);

import maintenance from "./maintenance.route";
router.use("/maintenances", maintenance);

import configuration from "./configuration.route";
router.use("/configurations", configuration);

import division from "./division.route";
router.use("/divisions", division);

import office from "./office.route";
router.use("/offices", office);

import schoolDivision from "./school-division.route";
router.use("/school-divisions", schoolDivision);

import school from "./school.route";
router.use("/schools", school);

import waste from "./waste.route";
router.use("/wastes", waste);

import returns from "./return.route";
router.use("/returns", returns);

import dashboard from "./dashboard.route";
router.use("/dashboard", dashboard);

export default router;
