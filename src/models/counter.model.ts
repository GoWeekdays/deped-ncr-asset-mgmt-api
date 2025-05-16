import { ObjectId } from "mongodb";

export type TCounter = {
  _id?: ObjectId;
  type: string;
  value?: number;
};

export class MCounter implements TCounter {
  _id?: ObjectId;
  type: string;
  value?: number;

  constructor(value: TCounter) {
    this._id = value?._id;
    this.type = value?.type ?? "";
    this.value = value?.value ?? 0;
  }
}
