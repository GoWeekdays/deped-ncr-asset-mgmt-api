import { TFile } from "../models/file.model";
import useFileRepository from "../repositories/file.repository";
import { logger, useS3 } from "@ph-deped-ncr/utils"
import { SPACES_ACCESS_KEY, SPACES_BUCKET, SPACES_ENDPOINT, SPACES_REGION, SPACES_SECRET_KEY } from "../config";
import { useAtlas } from "@ph-deped-ncr/utils"
import { ClientSession } from "mongodb";
import cron from "node-cron";
export default function useFileService() {
    const { createFile: _createFile, deleteFileById, getAllDraftedFiles } = useFileRepository();

    const s3 = new useS3({
        accessKeyId: SPACES_ACCESS_KEY,
        secretAccessKey: SPACES_SECRET_KEY,
        endpoint: SPACES_ENDPOINT,
        region: SPACES_REGION,
        bucket: SPACES_BUCKET,
    });

    const atlas = useAtlas.getInstance();

    async function createFile(value: Express.Multer.File) {

        const session: ClientSession = atlas.getClient().startSession();

        session.startTransaction();

        const file: TFile = {
            name: value.originalname,
            createdAt: new Date().toISOString(),
        }

        let id: string;

        try {
            id = await _createFile(file, session);
        } catch (error) {
            throw error;
        }

        try {
            await s3.uploadObject({
                key: id,
                body: value.buffer,
                contentType: value.mimetype
            });
        } catch (error) {
            throw error;
        }

        try {
            await session.commitTransaction();
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }

        return id;
    }

    async function deleteFile(id: string) {
        const session: ClientSession = atlas.getClient().startSession();

        session.startTransaction();

        try {
            await deleteFileById(id, session);
        } catch (error) {
            throw error;
        }

        try {
            await s3.deleteObject(id);
        } catch (error) {
            throw error;
        }

        try {
            await session.commitTransaction();
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }

        return "File deleted successfully";
    }

    function deleteDraft() {
        cron.schedule("0 0 * * *", async () => {
            const files = await getAllDraftedFiles();
            for (let index = 0; index < files.length; index++) {
                const file = files[index];
                try {
                    await deleteFile(file._id.toString());
                    await logger.log({ level: "info", message: "Successfully deleted draft files." });
                } catch (error) {
                    logger.log({ level: "info", message: "Successfully deleted draft files." });
                    return;
                }
            }


        });
    }

    return {
        createFile,
        deleteFile,
        deleteDraft
    }
}