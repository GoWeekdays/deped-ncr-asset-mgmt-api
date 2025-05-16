import { ObjectId } from "mongodb";

export type TItemStocks = {
  assetId: string | ObjectId;
  requestQty: number;
  issueQty?: number;
  remarks?: string;
};

export type TRISlip = {
  _id?: ObjectId;
  entityName: string;
  fundCluster: string;
  divisionId: string | ObjectId;
  officeId?: string | ObjectId;
  rcc: string; // auto-generated
  purpose: string;
  risNo?: string; // auto-generated
  remarks?: string;
  itemStocks: TItemStocks[];
  requestedBy: string | ObjectId;
  requestedByName?: string;
  approvedBy?: string | ObjectId;
  issuedBy?: string | ObjectId;
  receivedBy?: string | ObjectId;
  status?: string; // values: for-evaluation, evaluating, for-review, pending, issued, cancelled
  createdAt?: string;
  approvedAt?: string;
  completedAt?: string;
  updatedAt?: string | null;
};

export class MRISlip implements TRISlip {
  _id?: ObjectId;
  entityName: string;
  fundCluster: string;
  divisionId: string | ObjectId;
  officeId?: string | ObjectId;
  rcc: string;
  purpose: string;
  risNo?: string;
  remarks?: string;
  itemStocks: TItemStocks[];
  requestedBy: string | ObjectId;
  requestedByName?: string;
  approvedBy?: string | ObjectId;
  issuedBy?: string | ObjectId;
  receivedBy?: string | ObjectId;
  status?: string;
  createdAt?: string;
  approvedAt?: string;
  completedAt?: string;
  updatedAt?: string | null;

  constructor(value?: TRISlip) {
    this._id = value?._id;
    this.entityName = value?.entityName ?? "";
    this.fundCluster = value?.fundCluster ?? "";
    this.divisionId = value?.divisionId ? new ObjectId(value?.divisionId) : "";
    this.officeId = value?.officeId ? new ObjectId(value?.officeId) : "";
    this.rcc = value?.rcc ?? "";
    this.purpose = value?.purpose ?? "";
    this.risNo = value?.risNo ?? "";
    this.remarks = value?.remarks ?? "";
    if (value?.itemStocks) {
      for (const item of value?.itemStocks) {
        item.assetId = new ObjectId(item.assetId);
        item.requestQty = item.requestQty ?? 1;
        item.issueQty = item.issueQty ?? 0;
        item.remarks = item.remarks ?? "";
      }
    }
    this.itemStocks = value?.itemStocks ?? [];
    this.requestedBy = value?.requestedBy ? new ObjectId(value?.requestedBy) : "";
    this.requestedByName = value?.requestedByName ?? "";
    this.approvedBy = value?.approvedBy ? new ObjectId(value?.approvedBy) : "";
    this.issuedBy = value?.issuedBy ? new ObjectId(value?.issuedBy) : "";
    this.receivedBy = value?.receivedBy ? new ObjectId(value?.receivedBy) : "";
    this.status = value?.status ?? "for-evaluation";
    this.createdAt = value?.createdAt ?? new Date().toISOString();
    this.updatedAt = value?.updatedAt ?? null;
  }
}
