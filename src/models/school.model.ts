import { ObjectId } from "mongodb";

export type TSchool = {
  _id?: ObjectId;
  name: string;
  divisionId?: string | ObjectId;
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
};

export class MSchool implements TSchool {
  _id?: ObjectId;
  name: string;
  divisionId?: string | ObjectId;
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;

  constructor(value: TSchool) {
    this._id = value?._id;
    this.name = value?.name ?? "";
    this.divisionId = value?.divisionId ? new ObjectId(value?.divisionId) : "";
    this.createdAt = value?.createdAt ?? new Date().toISOString();
    this.updatedAt = value?.updatedAt ?? null;
    this.deletedAt = value?.deletedAt ?? null;
  }
}
