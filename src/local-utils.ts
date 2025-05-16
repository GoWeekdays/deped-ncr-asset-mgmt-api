import { TUser } from "./models/user.model";

export function concatenateName1(value: TUser) {
  return [
    value?.title?.trim() ? `${value.title} ` : "",
    value?.firstName ?? "",
    " ",
    value?.lastName ?? "",
    value?.suffix?.trim() ? ` ${value.suffix}` : "",
  ]
    .join("")
    .trim();
}

export function concatenateName(title?: string, firstName?: string, middleName?: string, lastName?: string, suffix?: string) {
  return [
    title?.trim() ? `${title} ` : "",
    firstName ?? "",
    middleName ? ` ${middleName}` : "",
    " ",
    lastName ?? "",
    suffix?.trim() ? ` ${suffix}` : "",
  ]
    .join("")
    .trim();
}
