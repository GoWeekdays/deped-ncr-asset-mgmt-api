import express from "express";
import { authMiddleware } from "@ph-deped-ncr/utils";
import { ACCESS_TOKEN_SECRET } from "./../config";
import useConfigController from "./../controllers/configuration.controller";

const { createConfig, getConfigs, updateConfig, deleteConfig } = useConfigController();

const router = express.Router();

const accessTokenSecret = ACCESS_TOKEN_SECRET;
const auth = authMiddleware(accessTokenSecret);

router.post("/", auth, createConfig);
router.get("/", auth, getConfigs);
router.put("/:id", auth, updateConfig);
router.delete("/:id", auth, deleteConfig);

export default router;
