import { ObjectId } from "mongodb";

export type TFile = {
    _id?: ObjectId;
    name: string;
    status?: string;
    createdAt: string;
};

export class MFile implements TFile {
    _id?: ObjectId;
    name: string;
    status?: string;
    createdAt: string;

    constructor(value: TFile) {
        this._id = value._id;
        this.name = value.name ?? "";
        this.status = value.status;
        this.createdAt = value.createdAt ?? new Date().toISOString();
    }
}