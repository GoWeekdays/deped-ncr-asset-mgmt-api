import { ObjectId } from "mongodb";

export type TSchoolDivision = {
  _id?: ObjectId;
  name: string;
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
};

export class MSchoolDivision implements TSchoolDivision {
  _id?: ObjectId;
  type?: string;
  name: string;
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;

  constructor(value: TSchoolDivision) {
    this._id = value?._id;
    this.name = value?.name ?? "";
    this.createdAt = value?.createdAt ?? new Date().toISOString();
    this.updatedAt = value?.updatedAt ?? null;
    this.deletedAt = value?.deletedAt ?? null;
  }
}
