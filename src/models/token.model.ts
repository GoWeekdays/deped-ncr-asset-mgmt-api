import { ObjectId } from "mongodb";

export type TToken = {
  _id?: ObjectId;
  token: string;
  user: string | ObjectId;
  createdAt?: string;
};

export class MToken implements TToken {
  _id?: ObjectId;
  token: string;
  user: string | ObjectId;
  createdAt?: string;

  constructor(value: TToken) {
    this._id = value._id ?? new ObjectId();
    this.token = value.token ?? "";
    this.user = value?.user ? new ObjectId(value?.user) : "";
    this.createdAt = value.createdAt ?? new Date().toISOString();
  }
}
