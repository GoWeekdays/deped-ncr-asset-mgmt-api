import { ObjectId } from "mongodb";

export type TRISlipSerialNo = {
  _id?: ObjectId;
  risId: string | ObjectId;
  serialNo: string;
  createdAt?: string;
};

export class MRISlipSerialNo implements TRISlipSerialNo {
  _id?: ObjectId;
  risId: string | ObjectId;
  serialNo: string;
  createdAt?: string;

  constructor(value?: TRISlipSerialNo) {
    this._id = value?._id;
    this.risId = value?.risId ? new ObjectId(value?.risId) : "";
    this.serialNo = value?.serialNo ?? "";
    this.createdAt = value?.createdAt ?? new Date().toISOString();
  }
}
