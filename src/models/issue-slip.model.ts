import { ObjectId } from "mongodb";

export type TIssueSlip = {
  _id?: ObjectId;
  type: string; // values: ICS (SEP), PAR (PPE)
  entityName: string;
  fundCluster: string;
  assetId: string | ObjectId;
  assetName?: string;
  quantity: number;
  estimatedUsefulLife?: number;
  serialNo?: string[];
  remarks?: string;
  issueSlipNo?: string;
  itemNo?: string;
  issueItemNo?: string;
  issuedBy?: string | ObjectId;
  issuedByName?: string;
  receivedBy?: string | ObjectId;
  receivedByName?: string;
  receivedAt?: string;
  status?: string; // values: pending, issued
  createdAt?: string;
  updatedAt?: string | null;
};

export class MIssueSlip implements TIssueSlip {
  _id?: ObjectId;
  type: string;
  entityName: string;
  fundCluster: string;
  assetId: string | ObjectId;
  assetName?: string;
  quantity: number;
  issueSlipNo?: string;
  itemNo?: string;
  issueItemNo?: string;
  estimatedUsefulLife?: number;
  serialNo?: string[];
  remarks?: string;
  issuedBy?: string | ObjectId;
  issuedByName?: string;
  receivedBy?: string | ObjectId;
  receivedByName?: string;
  receivedAt?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string | null;

  constructor(value: TIssueSlip) {
    this._id = value?._id;
    this.entityName = value?.entityName ?? "";
    this.fundCluster = value?.fundCluster ?? "";
    this.type = value?.type ?? "";
    this.assetId = value?.assetId ? new ObjectId(value?.assetId) : "";
    this.assetName = value?.assetName ?? "";
    this.quantity = value?.quantity ?? 0;
    this.estimatedUsefulLife = value?.estimatedUsefulLife ?? 0;
    this.serialNo = Array.isArray(value?.serialNo) ? value?.serialNo : [];
    this.remarks = value?.remarks ?? "";
    this.issueSlipNo = value?.issueSlipNo ?? "";
    this.itemNo = value?.itemNo ?? "";
    this.issueItemNo = value?.issueItemNo ?? "";
    this.issuedBy = value?.issuedBy ? new ObjectId(value?.issuedBy) : "";
    this.issuedByName = value?.issuedByName;
    this.receivedBy = value?.receivedBy ? new ObjectId(value?.receivedBy) : "";
    this.receivedByName = value?.receivedByName ?? "";
    this.receivedAt = value?.receivedAt ?? "";
    this.status = value?.status ?? "pending";
    this.createdAt = value?.createdAt ?? new Date().toISOString();
    this.updatedAt = value?.updatedAt ?? null;
  }
}
