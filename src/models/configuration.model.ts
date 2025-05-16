import { ObjectId } from "mongodb";

export type TConfig = {
  _id?: ObjectId;
  name: string;
  value: string;
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
};

export class MConfig implements TConfig {
  _id?: ObjectId;
  name: string;
  value: string;
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;

  constructor(value: TConfig) {
    this._id = value?._id;
    this.name = value?.name ?? "";
    this.value = value?.value ?? "";
    this.createdAt = value?.createdAt ?? new Date().toISOString();
    this.updatedAt = value?.updatedAt ?? null;
    this.deletedAt = value?.deletedAt ?? null;
  }
}
