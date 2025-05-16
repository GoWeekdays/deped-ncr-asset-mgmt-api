import { ObjectId } from "mongodb";

export type TItemStocks = {
  stockId: string | ObjectId;
};

export type TTransfer = {
  _id?: ObjectId;
  type: string; // values: inventory-transfer-report, property-transfer-report
  entityName: string;
  fundCluster: string;
  from: string;
  to: string;
  divisionId: string | ObjectId;
  schoolId?: string | ObjectId;
  transferNo: string; // auto-generated
  transferReason: string;
  transferType: string; // values: donation, relocate, reassignment, others
  itemStocks: TItemStocks[];
  approvedBy?: string | ObjectId;
  issuedBy?: string | ObjectId;
  receivedByName?: string;
  receivedByDesignation?: string;
  status?: string; // values: pending, approved, completed
  createdAt?: string;
  updatedAt?: string | null;
  approvedAt?: string;
  completedAt?: string;
};

export class MTransfer implements TTransfer {
  _id?: ObjectId;
  type: string;
  entityName: string;
  fundCluster: string;
  from: string;
  to: string;
  divisionId: string | ObjectId;
  schoolId?: string | ObjectId;
  transferNo: string;
  transferReason: string;
  transferType: string;
  itemStocks: TItemStocks[];
  approvedBy?: string | ObjectId;
  issuedBy?: string | ObjectId;
  receivedByName?: string;
  receivedByDesignation?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string | null;
  approvedAt?: string;
  completedAt?: string;

  constructor(value: TTransfer) {
    this._id = value?._id;
    this.type = value?.type ?? "";
    this.entityName = value?.entityName ?? "";
    this.fundCluster = value?.fundCluster ?? "";
    this.from = value?.from ?? "";
    this.to = value?.to ?? "";
    this.divisionId = value?.divisionId ? new ObjectId(value?.divisionId) : "";
    this.schoolId = value?.schoolId ? new ObjectId(value?.schoolId) : "";
    this.transferNo = value?.transferNo ?? "";
    this.transferReason = value?.transferReason ?? "";
    this.transferType = value?.transferType ?? "";

    if (value?.itemStocks) {
      for (const item of value?.itemStocks) {
        item.stockId = item?.stockId ? new ObjectId(item?.stockId) : "";
      }
    }

    this.itemStocks = value?.itemStocks ?? [];
    this.approvedBy = value?.approvedBy ? new ObjectId(value?.approvedBy) : "";
    this.issuedBy = value?.issuedBy ? new ObjectId(value?.issuedBy) : "";
    this.receivedByName = value?.receivedByName ?? "";
    this.receivedByDesignation = value?.receivedByDesignation ?? "";
    this.status = value?.status ?? "pending";
    this.createdAt = value?.createdAt ?? new Date().toISOString();
    this.updatedAt = value?.updatedAt ?? null;
  }
}
