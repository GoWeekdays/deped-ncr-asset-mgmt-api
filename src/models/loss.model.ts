import { ObjectId } from "mongodb";

export type TItemStocks = {
  stockId: string | ObjectId;
};

export type TLoss = {
  _id?: ObjectId;
  type: string; // values: RLSDDSP (SEP), RLSDDP (PPE)
  entityName: string;
  fundCluster: string;
  status: string; // values: pending, approved, completed
  lossStatus: string; // values: lost, stolen, damaged, destroyed
  lossNo: string; // auto-generated
  itemStocks: TItemStocks[];
  description?: string;
  officeName?: string;
  policeNotified: string; // values: yes, no
  policeStation: string;
  policeReportDate: string;
  attachment?: string;
  circumstances: string;
  governmentId: string;
  governmentIdNo: string;
  governmentIdDate: string;
  supervisorDate?: string;
  createdAt?: string;
  updatedAt?: string | null;
};

export class MLoss implements TLoss {
  _id?: ObjectId;
  type: string;
  entityName: string;
  fundCluster: string;
  status: string;
  lossStatus: string;
  lossNo: string;
  itemStocks: TItemStocks[];
  description?: string;
  officeName?: string;
  policeNotified: string;
  policeStation: string;
  policeReportDate: string;
  attachment?: string;
  circumstances: string;
  governmentId: string;
  governmentIdNo: string;
  governmentIdDate: string;
  supervisorDate?: string;
  createdAt?: string;
  updatedAt?: string | null;

  constructor(value: TLoss) {
    this._id = value?._id;
    this.type = value?.type ?? "";
    this.entityName = value?.entityName ?? "";
    this.fundCluster = value?.fundCluster ?? "";
    this.status = value?.status ?? "pending";
    this.lossStatus = value?.lossStatus ?? "";
    this.lossNo = value?.lossNo ?? "";

    if (value?.itemStocks) {
      for (const item of value?.itemStocks) {
        item.stockId = new ObjectId(item.stockId);
      }
    }

    this.itemStocks = value?.itemStocks ?? [];
    this.description = value?.description ?? "";
    this.officeName = value?.officeName ?? "";
    this.policeNotified = value?.policeNotified ?? "";
    this.policeStation = value?.policeStation ?? "";
    this.policeReportDate = value?.policeReportDate ?? "";
    this.attachment = value?.attachment ?? "";
    this.circumstances = value?.circumstances ?? "";
    this.governmentId = value?.governmentId ?? "";
    this.governmentIdNo = value?.governmentIdNo ?? "";
    this.governmentIdDate = value?.governmentIdDate ?? "";
    this.createdAt = value?.createdAt ?? new Date().toISOString();
    this.updatedAt = value?.updatedAt ?? null;
  }
}
