import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { BadRequestError, comparePassword, generateToken, hashPassword, InternalServerError, logger, NotFoundError } from "@ph-deped-ncr/utils";
import { ACCESS_TOKEN_EXPIRY, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_EXPIRY, REFRESH_TOKEN_SECRET } from "./../config";
import { useOTPRepo } from "./../repositories/otp.repository";
import { useTokenRepo } from "./../repositories/token.repository";
import { useUserRepo } from "./../repositories/user.repository";
import { useOTPService } from "./otp.service";

export function useAuthService() {
  const { getOTPById } = useOTPRepo();
  const { createToken, deleteToken, getToken } = useTokenRepo();
  const { getUserByEmail, updatePassword } = useUserRepo();
  const { verifyOTP } = useOTPService();

  async function login({ email, password } = {} as { email: string; password: string }) {
    try {
      // Fetch user by email
      const userData = await getUserByEmail(email);
      if (!userData) {
        throw new NotFoundError("Please check your credentials and try again.");
      }

      if (userData.status === "suspended") {
        throw new BadRequestError("Your account is currently suspended. Please contact support for assistance.");
      }

      // Verify password
      const isPasswordValid = await comparePassword(password, userData.password);
      if (!isPasswordValid) throw new BadRequestError("Passwords do not match.");

      if (!userData._id) throw new BadRequestError("Invalid user ID.");

      // Generate tokens
      const metadata = { user: userData._id, role: userData.type };
      const [refreshToken, accessToken] = await Promise.all([
        generateToken({ secret: REFRESH_TOKEN_SECRET, metadata, options: { expiresIn: REFRESH_TOKEN_EXPIRY } }),
        generateToken({ secret: ACCESS_TOKEN_SECRET, metadata, options: { expiresIn: ACCESS_TOKEN_EXPIRY } }),
      ]);

      // Store refresh token
      await createToken({ token: refreshToken, user: userData._id });
      return { accessToken, refreshToken, id: userData._id };
    } catch (error) {
      throw error;
    }
  }

  async function logout(token: string) {
    try {
      const tokenData = await getToken(token);
      if (!tokenData) throw new NotFoundError("Invalid token.");

      await deleteToken(token);
      return "Logged out successfully.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function refreshToken(token: string) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as { user: string, type: string };

      console.log("Decoded refresh token:", decoded);
      

      // Validate token existence
      const tokenData = await getToken(token);
      if (!tokenData) throw new NotFoundError("Invalid token.");

      return generateToken({ secret: ACCESS_TOKEN_SECRET, metadata: { user: decoded.user, type: decoded.type }, options: { expiresIn: ACCESS_TOKEN_EXPIRY } });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function resetPassword(otp: string, newPassword: string, passwordConfirmation: string) {
    // Verify OTP
    await verifyOTP(otp, "forget-password");

    if (newPassword !== passwordConfirmation) throw new BadRequestError("Passwords do not match.");

    try {
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);

      // Retrieve OTP document
      const otpData = await getOTPById(otp);
      if (!otpData) throw new NotFoundError("Failed to find OTP by ID.");

      // Retrieve user by email
      const user = await getUserByEmail(otpData.email);
      if (!user) throw new NotFoundError(`User not found.: ${otpData.email}`);

      // Validate user ID
      const userId = user._id?.toString();
      if (!userId) throw new BadRequestError("Invalid user ID.");

      await updatePassword(userId, hashedPassword);
      return "Updated password successfully.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw new InternalServerError(`Error updating password: ${error}`);
    }
  }

  return {
    login,
    logout,
    refreshToken,
    resetPassword,
  };
}
