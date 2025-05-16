import { Request, Response, NextFunction } from "express";
import useFileService from "../services/file.service";
import { AppError, BadRequestError, InternalServerError } from "@ph-deped-ncr/utils";
import Joi from "joi";

export default function useFileController() {
    const { createFile, deleteFile: _deleteFile } = useFileService();
    async function upload(req: Request, res: Response, next: NextFunction) {
        if (!req.file) return res.status(400).send("File is required!");

        try {
            const id = await createFile(req.file);
            return res.json({ message: "Successfully uploaded file", id });
        } catch (error: any) {
            if (error instanceof AppError) {
                next(error);
            } else {
                next(new InternalServerError(error));
            }
        }
    }

    async function deleteFile(req: Request, res: Response, next: NextFunction) {
        const id = req.params.id as string;

        const validation = Joi.string().required();

        const { error } = validation.validate(id);
        if (error) {
            next(new BadRequestError(error.message));
        }

        try {
            const message = await _deleteFile(id);
            return res.json({ message });
        } catch (error: any) {
            if (error instanceof AppError) {
                next(error);
            } else {
                next(new InternalServerError(error));
            }
        }
    }

    return {
        upload,
        deleteFile
    }
}