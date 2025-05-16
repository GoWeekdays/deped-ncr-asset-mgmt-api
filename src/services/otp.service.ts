import { useMailer, compileHandlebar, logger, getDirectory, BadRequestError, NotFoundError, useAtlas } from "@ph-deped-ncr/utils";
import {
  APP_ACCOUNT,
  MAILER_EMAIL,
  MAILER_PASSWORD,
  MAILER_TRANSPORT_HOST,
  MAILER_TRANSPORT_PORT,
  MAILER_TRANSPORT_SECURE,
  OTP_FORGET_PASSWORD_DURATION,
  OTP_UPDATE_EMAIL_DURATION,
  OTP_USER_INVITE_DURATION,
} from "./../config";
import { useOTPRepo } from "./../repositories/otp.repository";
import { useUserRepo } from "./../repositories/user.repository";

export function useOTPService() {
  const { createOTP, getOTPById, getOTPByType: _getOTPByType, updateOTPStatus, getOTPBySixDigits } = useOTPRepo();
  const { getUserById, getUserByEmail, updateUser } = useUserRepo();

  const atlas = useAtlas.getInstance();

  const mailer = new useMailer({
    host: MAILER_TRANSPORT_HOST,
    port: MAILER_TRANSPORT_PORT,
    secure: MAILER_TRANSPORT_SECURE,
    email: MAILER_EMAIL,
    password: MAILER_PASSWORD,
  });

  function calculateExpiration(durationMinutes: number): string {
    return new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
  }

  async function sendOTPEmail(templatePath: string, to: string, subject: string, context: object) {
    try {
      const emailContent = compileHandlebar({ context, filePath: getDirectory(__dirname, templatePath) });
      await mailer.sendMail({ to, subject, html: emailContent });
    } catch (error) {
      logger.log({ level: "error", message: `Failed to send email to ${to}: ${error}` });
    }
  }

  async function createForgetPasswordOTP(email: string) {
    try {
      const otp = await createOTP({
        type: "forget-password",
        email,
        expireAt: calculateExpiration(10), // 10 minutes from now
      });

      await sendOTPEmail("./../public/handlebars/forget-password", email, "Forget Password", {
        validity: OTP_FORGET_PASSWORD_DURATION,
        link: `${APP_ACCOUNT}/reset-password/${otp}`,
      });

      return `One-time password sent to ${email}.`;
    } catch (error) {
      logger.log({ level: "error", message: `Failed to create forget password OTP: ${error}` });
      throw error;
    }
  }

  async function createUpdateEmailOTP(email: string) {
    try {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otp = await createOTP({
        type: "update-email",
        email,
        otp: otpCode,
        expireAt: calculateExpiration(10), // 10 minutes from now
      });

      await sendOTPEmail("./../public/handlebars/update-email", email, "Update Email", {
        validity: OTP_UPDATE_EMAIL_DURATION,
        link: `${APP_ACCOUNT}/update-email/${otp}`,
        OTP: `${otpCode}`,
      });

      return `One-time password sent to ${email}.`;
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createUserInviteOTP({
    email,
    userType,
    officeId,
    divisionId,
  }: {
    email: string;
    userType: string;
    officeId?: string;
    divisionId?: string;
  }) {
    if (await getUserByEmail(email)) {
      return `User already exists: ${email}.`;
    }

    const formattedUserType = userType
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    try {
      const otp = await createOTP({
        type: "user-invite",
        email,
        userType,
        officeId,
        divisionId,
        expireAt: calculateExpiration(72 * 60), // 72 hours (3 days) from now
      });

      await sendOTPEmail("./../public/handlebars/user-invite", email, `User Invite for ${formattedUserType}`, {
        validity: OTP_USER_INVITE_DURATION,
        link: `${APP_ACCOUNT}/user-invite/${otp}`,
        userType: formattedUserType,
      });

      return `One-time password sent to ${email}.`;
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getOTPByType({ page = 1, limit = 10, sort = {}, search = "", type = "" }) {
    try {
      return await _getOTPByType({ page, limit, sort, search, type });
    } catch (error) {
      logger.log({ level: "error", message: `Failed to fetch ${type} OTPs: ${error}` });
      throw error;
    }
  }

  async function verifyOTPBySixDigits(id: string, otp: string) {
    const session = atlas.getClient().startSession();

    try {
      session.startTransaction();

      const otpData = await getOTPBySixDigits(otp);
      if (!otpData) throw new BadRequestError("Invalid OTP Number.");
      if (otpData.expireAt && new Date(otpData.expireAt) < new Date()) throw new BadRequestError("OTP has expired.");

      const user = await getUserById(id);
      if (!user) throw new NotFoundError("User not found.");

      await updateUser(id, { email: otpData.email }, session);
      await updateOTPStatus(otpData._id, "accepted", session);

      await session.commitTransaction();
      return "Email updated successfully.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async function verifyOTP(otp: string, expectedType?: string) {
    try {
      const otpData = await getOTPById(otp);
      if (!otpData) throw new NotFoundError("OTP not found.");
      if (Date.now() > new Date(otpData.expireAt).getTime()) throw new BadRequestError("OTP expired.");

      if (expectedType && otpData.type !== expectedType) throw new BadRequestError(`Expected ${expectedType}, but got ${otpData.type}.`);

      return "OTP is valid.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function cancelUserInviteOTP(otp: string) {
    try {
      await updateOTPStatus(otp, "cancelled");
      return "User invite OTP cancelled.";
    } catch (error) {
      logger.log({ level: "error", message: `Failed to cancel OTP: ${error}` });
      throw error;
    }
  }

  return {
    createForgetPasswordOTP,
    createUserInviteOTP,
    createUpdateEmailOTP,
    getOTPByType,
    verifyOTP,
    verifyOTPBySixDigits,
    cancelUserInviteOTP,
  };
}
