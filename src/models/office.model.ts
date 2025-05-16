import { ObjectId } from "mongodb";

export type TOffice = {
  _id?: ObjectId;
  name: string;
  email?: string;
  divisionId?: string | ObjectId;
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
};

export class MOffice implements TOffice {
  _id?: ObjectId;
  name: string;
  email?: string;
  divisionId?: string | ObjectId;
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;

  constructor(value: TOffice) {
    this._id = value?._id;
    this.name = value?.name ?? "";
    this.email = value?.email ?? "";
    this.divisionId = value?.divisionId ? new ObjectId(value?.divisionId) : "";
    this.createdAt = value?.createdAt ?? new Date().toISOString();
    this.updatedAt = value?.updatedAt ?? null;
    this.deletedAt = value?.deletedAt ?? null;
  }
}
