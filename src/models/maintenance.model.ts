import { ObjectId } from "mongodb";

export type TMaintenance = {
  _id?: ObjectId;
  code: string;
  assigneeId: string | ObjectId;
  stockId: string | ObjectId;
  name?: string;
  officeName?: string;
  issue: string;
  type?: string;
  rescheduleReason?: string;
  attachment?: string;
  remarks?: string;
  completedBy?: string | ObjectId;
  status?: string; // values: pending, cancelled, scheduled, rescheduled, completed
  createdAt?: string;
  scheduledAt?: string | null;
  updatedAt?: string | null;
};

export class MMaintenance implements TMaintenance {
  _id?: ObjectId;
  code: string;
  assigneeId: string | ObjectId;
  stockId: string | ObjectId;
  name?: string;
  officeName?: string;
  issue: string;
  type?: string;
  rescheduleReason?: string;
  attachment?: string;
  remarks?: string;
  completedBy?: string | ObjectId;
  status?: string;
  createdAt?: string;
  scheduledAt?: string | null;
  updatedAt?: string | null;

  constructor(value: TMaintenance) {
    this._id = value?._id;
    this.code = value?.code ?? "";
    this.assigneeId = value?.assigneeId ? new ObjectId(value?.assigneeId) : "";
    this.stockId = value?.stockId ? new ObjectId(value?.stockId) : "";
    this.name = value?.name ?? "";
    this.officeName = value?.officeName ?? "";
    this.issue = value?.issue ?? "";
    this.type = value?.type ?? "";
    this.rescheduleReason = value?.rescheduleReason ?? "";
    this.attachment = value?.attachment ?? "";
    this.remarks = value?.remarks ?? "";
    this.completedBy = value?.completedBy ? new ObjectId(value?.completedBy) : "";
    this.status = value?.status ?? "pending";
    this.createdAt = value?.createdAt ?? new Date().toISOString();
    this.scheduledAt = value?.scheduledAt ?? null;
    this.updatedAt = value?.updatedAt ?? null;
  }
}
