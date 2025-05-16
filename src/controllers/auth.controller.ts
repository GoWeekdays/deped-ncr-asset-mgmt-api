import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { BadRequestError, logger } from "@ph-deped-ncr/utils";
import { useAuthService } from "./../services/auth.service";

export function useAuthController() {
  const { login: _login, logout: _logout, refreshToken: _refreshToken, resetPassword: _resetPassword } = useAuthService();

  async function login(req: Request, res: Response, next: NextFunction) {
    const email = (req.body.email as string) || "";
    const password = (req.body.password as string) || "";

    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    });

    const { error } = schema.validate({ email, password });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const token = await _login({ email, password });
      return res.json(token);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function logout(req: Request, res: Response, next: NextFunction) {
    const token = (req.params.id as string) || "";

    const schema = Joi.string().required();

    const { error } = schema.validate(token);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(`${error.message}`));
    }

    try {
      await _logout(token);
      return res.json({ message: "Logged out successfully." });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function refreshToken(req: Request, res: Response, next: NextFunction) {
    const refreshToken = req.body.token as string;

    const schema = Joi.string().required();

    const { error } = schema.validate(refreshToken);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(`${error.message}`));
    }

    try {
      const newRefreshToken = await _refreshToken(refreshToken);
      return res.json({ token: newRefreshToken });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function resetPassword(req: Request, res: Response, next: NextFunction) {
    const otp = (req.body.otp as string) || "";
    const newPassword = (req.body.newPassword as string) || "";
    const passwordConfirmation = (req.body.passwordConfirmation as string) || "";

    const schema = Joi.object({
      otp: Joi.string().required(),
      newPassword: Joi.string().required().min(8),
      passwordConfirmation: Joi.string().required().min(8),
    });

    const { error } = schema.validate({ otp, newPassword, passwordConfirmation });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _resetPassword(otp, newPassword, passwordConfirmation);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  return {
    login,
    logout,
    refreshToken,
    resetPassword,
  };
}
