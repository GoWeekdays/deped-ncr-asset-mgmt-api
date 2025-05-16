import { ObjectId } from "mongodb";

export type TUser = {
  _id?: ObjectId;
  email?: string;
  password: string;
  title?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  type?: string; // values: admin, admin-head, office-chief, personnel
  designation: string;
  officeId?: string | ObjectId;
  divisionId?: string | ObjectId;
  attachment?: string;
  status?: string; // values: active, pending
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
};

export class MUser implements TUser {
  _id?: ObjectId;
  email?: string;
  password: string;
  title?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  type?: string;
  designation: string;
  officeId?: string | ObjectId;
  divisionId?: string | ObjectId;
  attachment?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;

  constructor(value: TUser) {
    this._id = value._id ?? new ObjectId();
    this.email = value.email ?? "";
    this.password = value.password ?? "";
    this.title = value.title ?? "";
    this.firstName = value.firstName ?? "";
    this.middleName = value.middleName ?? "";
    this.lastName = value.lastName ?? "";
    this.suffix = value.suffix ?? "";
    this.type = value.type ?? "";
    this.designation = value.designation ?? "";
    this.officeId = value?.officeId ? new ObjectId(value?.officeId) : "";
    this.divisionId = value?.divisionId ? new ObjectId(value?.divisionId) : "";
    this.attachment = value?.attachment ?? "";
    this.status = value.status ?? "active";
    this.createdAt = value.createdAt ?? new Date().toISOString();
    this.updatedAt = value.updatedAt ?? null;
    this.deletedAt = value?.deletedAt ?? null;
  }
}
