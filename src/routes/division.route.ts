import express from "express";
import { authMiddleware } from "@ph-deped-ncr/utils";
import { ACCESS_TOKEN_SECRET } from "./../config";
import useDivisionController from "./../controllers/division.controller";

const { createDivision, getDivisions, getDivisionById, updateDivision, deleteDivision } = useDivisionController();

const router = express.Router();

const accessTokenSecret = ACCESS_TOKEN_SECRET;
const auth = authMiddleware(accessTokenSecret);

router.post("/", auth, createDivision);
router.get("/", auth, getDivisions);
router.get("/:id", auth, getDivisionById);
router.put("/:id", auth, updateDivision);
router.delete("/:id", auth, deleteDivision);

export default router;
