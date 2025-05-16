import express from "express";
import { authMiddleware } from "@ph-deped-ncr/utils";
import { ACCESS_TOKEN_SECRET } from "./../config";
import useSchoolController from "./../controllers/school.controller";

const { createSchool, findOrCreateSchool, getSchools, getSchoolById, updateSchool, deleteSchool } = useSchoolController();

const router = express.Router();

const accessTokenSecret = ACCESS_TOKEN_SECRET;
const auth = authMiddleware(accessTokenSecret);

router.post("/", auth, createSchool);
router.post("/find-or-create", auth, findOrCreateSchool);
router.get("/", auth, getSchools);
router.get("/:id", auth, getSchoolById);
router.put("/:id", auth, updateSchool);
router.delete("/:id", auth, deleteSchool);

export default router;
