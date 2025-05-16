import { ObjectId } from "mongodb";

export type TOneTimePassword = {
  _id?: ObjectId;
  type: string;
  email?: string;
  userType?: string;
  officeId?: string | ObjectId;
  divisionId?: string | ObjectId;
  otp?: string;
  status?: string; // values: pending, accepted, cancelled
  createdAt?: string;
  updatedAt?: string | null;
  expireAt?: string;
};

export class MOneTimePassword implements TOneTimePassword {
  _id?: ObjectId;
  type: string;
  email?: string;
  userType?: string;
  officeId?: string | ObjectId;
  divisionId?: string | ObjectId;
  otp?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string | null;
  expireAt?: string;

  constructor(value: TOneTimePassword) {
    this._id = value._id ?? new ObjectId();
    this.type = value.type ?? "";
    this.email = value.email ?? "";

    if (this.type && ["user-invite"].includes(this.type)) {
      this.userType = value.userType ?? "";
      this.officeId = value?.officeId ? new ObjectId(value?.officeId) : "";
      this.divisionId = value?.divisionId ? new ObjectId(value?.divisionId) : "";
    }

    if (this.type && ["update-email"].includes(this.type)) {
      this.otp = value.otp ?? "";
    }

    this.status = value.status ?? "pending";
    this.updatedAt = value.updatedAt ?? null;
    this.createdAt = value.createdAt ?? new Date().toISOString();
    this.expireAt = value.expireAt;
  }
}
