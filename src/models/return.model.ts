import { ObjectId } from "mongodb";

export type TItemStocks = {
  stockId: string | ObjectId;
  stockRemarks: string; // values: for-reissue, for-disposal
};

export type TReturn = {
  _id?: ObjectId;
  type: string; // values: SEP, PPE
  entityName: string;
  fundCluster: string;
  returnNo: string;
  itemStocks: TItemStocks[];
  officeName?: string;
  returnedBy: string | ObjectId;
  returnedByName?: string;
  approvedBy?: string | ObjectId;
  receivedBy?: string | ObjectId;
  status?: string; // values: pending, approved, completed
  createdAt?: string;
  approvedAt?: string;
  completedAt?: string;
  updatedAt?: string | null;
};

export class MReturn implements TReturn {
  _id?: ObjectId;
  type: string;
  entityName: string;
  fundCluster: string;
  returnNo: string;
  itemStocks: TItemStocks[];
  officeName?: string;
  returnedBy: string | ObjectId;
  returnedByName?: string;
  approvedBy?: string | ObjectId;
  receivedBy?: string | ObjectId;
  status?: string;
  createdAt?: string;
  approvedAt?: string;
  completedAt?: string;
  updatedAt?: string | null;

  constructor(value?: TReturn) {
    this._id = value?._id;
    this.type = value?.type ?? "";
    this.entityName = value?.entityName ?? "";
    this.fundCluster = value?.fundCluster ?? "";
    this.returnNo = value?.returnNo ?? "";

    if (value?.itemStocks) {
      for (const item of value?.itemStocks) {
        item.stockId = new ObjectId(item.stockId);
      }
    }

    this.itemStocks = value?.itemStocks ?? [];
    this.officeName = value?.officeName ?? "";
    this.returnedBy = value?.returnedBy ? new ObjectId(value?.returnedBy) : "";
    this.returnedByName = value?.returnedByName ?? "";
    this.approvedBy = value?.approvedBy ? new ObjectId(value?.approvedBy) : "";
    this.receivedBy = value?.receivedBy ? new ObjectId(value?.receivedBy) : "";
    this.status = value?.status ?? "pending";
    this.createdAt = value?.createdAt ?? new Date().toISOString();
    this.updatedAt = value?.updatedAt ?? null;
  }
}
