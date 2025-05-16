import { useAtlas } from "@ph-deped-ncr/utils";
import { MFile, TFile } from "../models/file.model";
import { ObjectId, ClientSession } from "mongodb";

export default function useFileRepository() {
    const atlas = useAtlas.getInstance();
    const collection = atlas.getDb().collection("files");

    async function createFile(value: TFile, session?: ClientSession) {
        try {
            const res = await collection.insertOne(value, { session })
            return res.insertedId.toString();
        } catch (error) {
            return Promise.reject(error);
        }
    }

    async function deleteFileById(_id: string | ObjectId, session?: ClientSession) {
        try {
            _id = new ObjectId(_id);
        } catch (error) {
            return Promise.reject("Invalid ID.");
        }

        try {
            await collection.deleteOne({ _id }, { session });
            return "File deleted successfully";
        } catch (error) {
            return Promise.reject(error);
        }
    }

    async function getAllDraftedFiles() {
        try {
            return await collection.find({ status: "draft" }).toArray();
        } catch (error) {
            return Promise.reject(error);
        }
    }

    return {
        createFile,
        deleteFileById,
        getAllDraftedFiles
    }
}