import { ObjectId } from "mongodb";

export enum EWasteType {
  destroyed = "destroyed",
  soldAtPrivateSale = "sold-at-private-sale",
  soldAtPublicAuction = "sold-at-public-auction",
  transferredWithoutCost = "transferred-without-cost",
}

export type TItemStocks = {
  stockId: string | ObjectId;
  type?: string;
  remarks?: string;
  transferredTo?: string;
};

export type TWaste = {
  _id?: ObjectId;
  entityName?: string;
  fundCluster?: string;
  placeOfStorage?: string;
  itemStocks: TItemStocks[];
  status?: string;
  certifiedBy?: string | ObjectId;
  disposalApprovedBy?: string | ObjectId;
  witnessedByName?: string;
  createdAt?: string;
  updatedAt?: string | null;
};

export class MWaste implements TWaste {
  _id?: ObjectId;
  placeOfStorage?: string;
  entityName?: string;
  fundCluster?: string;
  itemStocks: TItemStocks[];
  status?: string;
  certifiedBy?: string | ObjectId;
  disposalApprovedBy?: string | ObjectId;
  witnessedByName?: string;
  createdAt?: string;
  updatedAt?: string | null;

  constructor(value: TWaste) {
    this._id = value?._id;
    this.entityName = value?.entityName ?? "";
    this.fundCluster = value?.fundCluster ?? "";
    this.placeOfStorage = value?.placeOfStorage;

    if (value?.itemStocks) {
      for (const item of value?.itemStocks) {
        item.stockId = new ObjectId(item.stockId);
      }
    }

    this.itemStocks = value?.itemStocks ?? [];
    this.status = value?.status ?? "pending";
    this.certifiedBy = value?.certifiedBy ? new ObjectId(value?.certifiedBy) : "";
    this.disposalApprovedBy = value?.disposalApprovedBy ? new ObjectId(value?.disposalApprovedBy) : "";
    this.witnessedByName = value?.witnessedByName ?? "";
    this.createdAt = value?.createdAt ?? new Date().toISOString();
    this.updatedAt = value?.updatedAt ?? null;
  }
}
