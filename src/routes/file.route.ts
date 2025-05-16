import express from "express";
const router = express.Router();
import _multer from "multer";
const multer = _multer();

import FileCtrl from "../controllers/file.controller";
const { upload, deleteFile } = FileCtrl();

router.post("/", multer.single("file"), upload);
router.delete("/:id", deleteFile);

export default router;
