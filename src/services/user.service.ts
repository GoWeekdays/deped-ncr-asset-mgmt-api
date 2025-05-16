import { ObjectId } from "mongodb";
import { comparePassword } from "@ph-deped-ncr/utils";
import { BadRequestError, InternalServerError, NotFoundError, hashPassword, logger } from "@ph-deped-ncr/utils";
import { DEFAULT_ADMIN_USER_EMAIL, DEFAULT_USER_EMAIL } from "./../config";
import { TUser } from "./../models/user.model";
import { useOTPRepo } from "./../repositories/otp.repository";
import { useUserRepo } from "./../repositories/user.repository";
import { useOTPService } from "./otp.service";

export function useUserService() {
  const { getOTPById, updateOTPStatus } = useOTPRepo();
  const {
    createUser: _createUser,
    getUsers: _getUsers,
    getUsersByType: _getUsersByType,
    getUserByEmail,
    getUserById: _getUserById,
    updateUser: _updateUser,
    updateUserStatus: _updateUserStatus,
    deleteUser: _deleteUser,
    getPersonnelList: _getPersonnelList,
    updatePassword,
  } = useUserRepo();
  const { verifyOTP } = useOTPService();

  async function createUser(value: TUser) {
    const { email, password } = value;

    try {
      // Check if user already exists
      if (!email) throw new NotFoundError("Email not found.");
      const userData = await getUserByEmail(email);
      if (userData) {
        return `User already exists: ${email}.`;
      }

      // Hash password
      value.password = await hashPassword(password);

      // Create user
      return await _createUser(value);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function acceptUserInvite(otp: string) {
    try {
      await verifyOTP(otp, "user-invite");

      const otpDoc = await getOTPById(otp);
      if (!otpDoc) throw new NotFoundError("OTP not found.");

      const user = await getUserByEmail(otpDoc.email);
      if (user) throw new BadRequestError("User already exists.");

      return {
        email: otpDoc.email,
        userType: otpDoc.userType,
        officeId: otpDoc.officeId,
        divisionId: otpDoc.divisionId,
      };
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw new InternalServerError(`Error accepting user invitation: ${error}`);
    }
  }

  async function createUserWithInvite({ otp, value }: { otp: string; value: TUser }) {
    try {
      // Step 1: Accept the invitation
      const userInvite = await acceptUserInvite(otp);
      if (!userInvite || !userInvite.email || !userInvite.userType) throw new BadRequestError("Invalid user invitation data");

      // Step 2: Assign user details from the invite
      const { email, userType, officeId, divisionId } = userInvite;
      value.email = email;
      value.type = userType;
      value.officeId = officeId;
      value.divisionId = divisionId;

      // Step 3: Create the user
      const newUser = await createUser(value);

      // Step 4: Update the OTP status to "accepted"
      await updateOTPStatus(otp, "accepted");

      return newUser;
    } catch (error) {
      logger.log({ level: "error", message: `Create user with invite failed: ${error}` });
      throw error;
    }
  }

  async function getUsers({ page = 1, limit = 10, sort = {}, search = "" } = {}) {
    try {
      return await _getUsers({ page, limit, sort, search });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getUsersByType({ page = 1, limit = 10, sort = {}, search = "", type = "" } = {}) {
    try {
      return await _getUsersByType({ page, limit, sort, search, type });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getUserById(id: string) {
    try {
      return await _getUserById(id);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateUser(id: string, value: Partial<TUser>) {
    try {
      return await _updateUser(id, value);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateUserStatus(id: string, status: string) {
    try {
      const user = await _getUserById(id);
      if (!user) throw new NotFoundError("User not found.");

      return await _updateUserStatus(id, status);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function deleteUser(id: string) {
    try {
      const user = await _getUserById(id);
      if (!user) throw new NotFoundError("User not found.");

      return await _deleteUser(id);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateOldPassword(id: string, oldPassword: string, newPassword: string) {
    const user = await _getUserById(id);
    if (!user) throw new NotFoundError("User not found.");

    const isMatch = await comparePassword(oldPassword, user?.password);
    if (!isMatch) throw new BadRequestError("Old password is incorrect.");

    const hashedNewPassword = await hashPassword(newPassword);

    try {
      await updatePassword(id, hashedNewPassword);
      return "Successfully updated password.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getPersonnelList({ page = 1, limit = 10, sort = {}, search = "" } = {}) {
    try {
      const items = await _getPersonnelList({ page, limit, sort, search });
      return items;
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createUser,
    acceptUserInvite,
    createUserWithInvite,
    getUsers,
    getUsersByType,
    getUserById,
    updateUser,
    updateUserStatus,
    deleteUser,
    updateOldPassword,
    getPersonnelList,
  };
}
