import { ObjectId } from "mongodb";

export type TAssetCode = {
  _id?: ObjectId;
  type?: string; // values: serial-code, sep-code, ppe-code, location-code
  code: string;
  value: string;
  year?: number;
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
};

export class MAssetCode implements TAssetCode {
  _id?: ObjectId;
  type?: string;
  code: string;
  value: string;
  year?: number;
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;

  constructor(value: TAssetCode) {
    this._id = value?._id;
    this.type = value?.type ?? "";
    this.code = value?.code ?? "";
    this.value = value?.value ?? "";

    if (this.type === "ppe-code") {
      this.year = value?.year ?? 0;
    }

    this.createdAt = value?.createdAt ?? new Date().toISOString();
    this.updatedAt = value?.updatedAt ?? null;
    this.deletedAt = value?.deletedAt ?? null;
  }
}
