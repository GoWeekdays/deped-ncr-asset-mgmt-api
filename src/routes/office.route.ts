import express from "express";
import { authMiddleware } from "@ph-deped-ncr/utils";
import { ACCESS_TOKEN_SECRET } from "./../config";
import useOfficeController from "./../controllers/office.controller";

const { createOffice, getOffices, getOfficeById, updateOffice, deleteOffice, getOfficeNames, getOfficesWithoutOfficeChief } = useOfficeController();

const router = express.Router();

const accessTokenSecret = ACCESS_TOKEN_SECRET;
const auth = authMiddleware(accessTokenSecret);

router.post("/", auth, createOffice);
router.get("/list", auth, getOfficesWithoutOfficeChief);
router.get("/", auth, getOffices);
router.get("/names", auth, getOfficeNames);
router.get("/:id", auth, getOfficeById);
router.put("/:id", auth, updateOffice);
router.delete("/:id", auth, deleteOffice);

export default router;
