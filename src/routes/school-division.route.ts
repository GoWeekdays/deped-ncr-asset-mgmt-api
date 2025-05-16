import express from "express";
import { authMiddleware } from "@ph-deped-ncr/utils";
import { ACCESS_TOKEN_SECRET } from "./../config";
import useSchoolDivisionController from "./../controllers/school-division.controller";

const { createSchoolDivision, getSchoolDivisions, getSchoolDivisionById, updateSchoolDivision, deleteSchoolDivision } = useSchoolDivisionController();

const router = express.Router();

const accessTokenSecret = ACCESS_TOKEN_SECRET;
const auth = authMiddleware(accessTokenSecret);

router.post("/", auth, createSchoolDivision);
router.get("/", auth, getSchoolDivisions);
router.get("/:id", auth, getSchoolDivisionById);
router.put("/:id", auth, updateSchoolDivision);
router.delete("/:id", auth, deleteSchoolDivision);

export default router;
