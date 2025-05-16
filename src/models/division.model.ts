import { ObjectId } from "mongodb";

export type TDivision = {
  _id?: ObjectId;
  name: string;
  email?: string;
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
};

export class MDivision implements TDivision {
  _id?: ObjectId;
  name: string;
  email?: string;
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;

  constructor(value: TDivision) {
    this._id = value?._id;
    this.name = value?.name ?? "";
    this.email = value?.email ?? "";
    this.createdAt = value?.createdAt ?? new Date().toISOString();
    this.updatedAt = value?.updatedAt ?? null;
    this.deletedAt = value?.deletedAt ?? null;
  }
}
