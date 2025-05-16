import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { BadRequestError, logger } from "@ph-deped-ncr/utils";
import { useOTPService } from "./../services/otp.service";

export function useOTPController() {
  const {
    createForgetPasswordOTP,
    createUserInviteOTP,
    createUpdateEmailOTP,
    getOTPByType: _getOTPByType,
    verifyOTP: _verifyOTP,
    cancelUserInviteOTP: _cancelUserInviteOTP,
    verifyOTPBySixDigits: _verifyOTPBySixDigits,
  } = useOTPService();

  const acceptedTypes = ["user-invite", "forget-password", "update-email"];

  async function generateForgetPasswordOTP(req: Request, res: Response, next: NextFunction) {
    const email = (req.body.email as string) || "";

    const schema = Joi.string().email().required();

    const { error } = schema.validate(email);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await createForgetPasswordOTP(email);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function generateUpdateEmailOTP(req: Request, res: Response, next: NextFunction) {
    const email = (req.body.email as string) || "";

    const schema = Joi.string().email().required();

    const { error } = schema.validate(email);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await createUpdateEmailOTP(email);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function generateUserInviteOTP(req: Request, res: Response, next: NextFunction) {
    const email = (req.body.email as string) || "";
    const userType = (req.body.userType as string) || "";
    const officeId = (req.body.officeId as string) || "";
    const divisionId = (req.body.divisionId as string) || "";

    const schema = Joi.object({
      email: Joi.string().email().required(),
      userType: Joi.string().required(),
      officeId: Joi.string().allow("").optional(),
      divisionId: Joi.string().allow("").optional(),
    });

    const { error } = schema.validate({ email, userType, officeId, divisionId });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await createUserInviteOTP({ email, userType, officeId, divisionId });
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getOTPByType(req: Request, res: Response, next: NextFunction) {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";
    const type = (req.params.type as string) || "";

    const schema = Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().min(10).max(50).optional(),
      sort: Joi.object().optional(),
      search: Joi.string().allow("").optional(),
      type: Joi.string()
        .valid(...acceptedTypes)
        .required(),
    });

    const { error } = schema.validate({ page, limit, sort, search, type });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const otp = await _getOTPByType({ page, limit, sort, search, type });
      return res.json(otp);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function verifyOTP(req: Request, res: Response, next: NextFunction) {
    const otp = (req.body.otp as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(otp);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _verifyOTP(otp);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function verifyOTPBySixDigits(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";
    const otp = (req.body.otp as string) || "";

    const schema = Joi.object({
      id: Joi.string().hex().required(),
      otp: Joi.string().hex().length(6).required(),
    });

    const { error } = schema.validate({ id, otp });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _verifyOTPBySixDigits(id, otp);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function cancelUserInviteOTP(req: Request, res: Response, next: NextFunction) {
    const otp = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(otp);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _cancelUserInviteOTP(otp);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  return {
    generateForgetPasswordOTP,
    generateUserInviteOTP,
    generateUpdateEmailOTP,
    getOTPByType,
    verifyOTP,
    verifyOTPBySixDigits,
    cancelUserInviteOTP,
  };
}
