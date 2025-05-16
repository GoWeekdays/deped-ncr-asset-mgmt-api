import { ObjectId } from "mongodb";

export type TStock = {
  _id?: ObjectId;
  assetId: string | ObjectId;
  assetName?: string;
  reference?: string;
  serialNo?: string; // only for SEP, PPE
  attachment?: string;
  officeId?: string | ObjectId;
  officeName?: string;
  ins?: number;
  outs?: number;
  balance?: number;
  numberOfDaysToConsume?: number; // only for consumable
  itemNo?: string; // only for SEP, PPE
  remarks?: string; // only for SEP, PPE
  initialCondition?: string;
  condition?: string; // only for SEP, PPE; values: good-condition, reissued, transferred, returned, for-disposal, for-repair
  createdAt?: string;
};

export class MStock implements TStock {
  _id?: ObjectId;
  assetId: string | ObjectId;
  assetName?: string;
  reference?: string;
  serialNo?: string;
  attachment?: string;
  officeId?: string | ObjectId;
  officeName?: string;
  ins?: number;
  outs?: number;
  balance?: number;
  numberOfDaysToConsume?: number;
  itemNo?: string;
  remarks?: string;
  condition?: string;
  createdAt?: string;

  constructor(value: TStock) {
    this._id = value?._id;
    this.assetId = value?.assetId ? new ObjectId(value?.assetId) : "";
    this.assetName = value?.assetName ?? "";
    this.reference = value?.reference ?? "";
    this.serialNo = value?.serialNo ?? "";
    this.attachment = value?.attachment ?? "";
    this.officeId = value?.officeId ? new ObjectId(value?.officeId) : "";
    this.officeName = value?.officeName ?? "";
    this.ins = value?.ins ?? 0;
    this.outs = value?.outs ?? 0;
    this.balance = value?.balance ?? 0;
    this.numberOfDaysToConsume = value?.numberOfDaysToConsume ?? 0;
    this.itemNo = value?.itemNo ?? "";
    this.remarks = value?.remarks ?? "";
    this.condition = value?.condition || "good-condition";
    this.createdAt = value?.createdAt ? new Date(value.createdAt).toISOString() : new Date().toISOString();
  }
}
