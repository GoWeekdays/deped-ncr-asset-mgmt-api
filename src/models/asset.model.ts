import { ObjectId } from "mongodb";

export type TPropNumAttrib = {
  year: string;
  propertyCode: string;
  serialNumber: string;
  quantity?: string;
  location: string;
  counter?: string;
};

export type TUpdatePropertyOptions = {
  name: string;
  description: string;
  year: string;
  propertyCode: string;
  serialCode: string;
  locationCode: string;
  unitOfMeasurement?: string;
  condition?: string;
};

export type TAsset = {
  _id?: ObjectId;
  type?: string; // values: consumable, SEP, PPE
  entityName?: string;
  fundCluster?: string;
  stockNumber?: string; // only for consumable
  reorderPoint?: string; // only for consumable
  name: string;
  description: string;
  unitOfMeasurement?: string;
  article?: string;
  cost?: number;
  initialQty?: number; // only for SEP, PPE
  quantity?: number; // only for SEP, PPE
  propNumAttrib?: TPropNumAttrib; // only for SEP, PPE
  modeOfAcquisition?: string; // only for SEP and PPE; values: procurement, donation, transfer
  procurementType?: string; // only for SEP and PPE; values: ps-dbm, bidding, quotation
  supplier?: string; // only for SEP and PPE
  condition?: string; // only for SEP, PPE; values: good-condition, issued, transferred, returned, for-disposal, for-repair
  status?: string;
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
};

export class MAsset implements TAsset {
  _id?: ObjectId;
  type?: string;
  entityName?: string;
  fundCluster?: string;
  stockNumber?: string;
  reorderPoint?: string;
  name: string;
  description: string;
  unitOfMeasurement?: string;
  article: string;
  cost?: number;
  initialQty?: number;
  quantity?: number;
  propNumAttrib?: TPropNumAttrib;
  modeOfAcquisition?: string;
  procurementType?: string;
  supplier?: string;
  condition?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;

  constructor(value: TAsset) {
    this._id = value?._id;
    this.type = value?.type;
    this.entityName = value?.entityName;
    this.fundCluster = value?.fundCluster;
    this.name = value?.name;
    this.description = value?.description;
    this.unitOfMeasurement = value?.unitOfMeasurement ?? "";
    this.article = value?.article ?? "";
    this.cost = value?.cost ?? 0;
    this.quantity = value?.quantity ?? 0;

    if (this.type && ["SEP", "PPE"].includes(this.type)) {
      this.propNumAttrib = value?.propNumAttrib ?? {
        year: "",
        propertyCode: "",
        serialNumber: "",
        quantity: "",
        location: "",
        counter: "",
      };
    }

    // Generate propertyNumber if propNumAttrib is provided
    if (this.propNumAttrib && this.type && ["SEP", "PPE"].includes(this.type)) {
      const { year, propertyCode, serialNumber, quantity, location, counter } = this.propNumAttrib;
      this.stockNumber = `${year}-${propertyCode}-${serialNumber}-${quantity}-${location}-${counter}`;

      this.modeOfAcquisition = value?.modeOfAcquisition ?? "";

      if (value?.modeOfAcquisition === "procurement") {
        this.procurementType = value?.procurementType ?? "";

        // Only set supplier if procurementType is "bidding" or "quotation"
        if (["bidding", "quotation"].includes(this.procurementType)) {
          this.supplier = value?.supplier ?? "";
        }
      }

      this.initialQty = value?.initialQty ?? 0;
      this.condition = value?.condition ?? "good-condition";
    } else {
      this.stockNumber = value?.stockNumber ?? "";
    }

    if (this.type && ["consumable"].includes(this.type)) {
      this.reorderPoint = value?.reorderPoint ?? "";
    }

    this.status = value?.status ?? "active";
    this.createdAt = value?.createdAt ? new Date(value.createdAt).toISOString() : new Date().toISOString();
    this.updatedAt = value?.updatedAt ?? null;
    this.deletedAt = value?.deletedAt ?? null;
  }
}
