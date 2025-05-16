import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { BadRequestError, logger } from "@ph-deped-ncr/utils";
import useLossService from "./../services/loss.service";
import { TKeyValuePair } from "./../local";

const acceptedTypes = ["RLSDDSP", "RLSDDP"];
const acceptedPoliceNotified = ["yes", "no"];
const acceptedLossStatuses = ["lost", "stolen", "damaged", "destroyed"];
const acceptedFilterStatuses = ["all", "pending", "approved", "completed"];

export default function useLossController() {
  const {
    createLoss: _createLoss,
    getLosses: _getLosses,
    getLossById: _getLossById,
    updateStatusToApproved: _updateStatusToApproved,
    updateStatusToCompleted: _updateStatusToCompleted,
  } = useLossService();

  const itemStockSchema = Joi.object({
    stockId: Joi.string().hex().required(),
  });

  async function createLoss(req: Request, res: Response, next: NextFunction) {
    const payload = req.body;
    const schema = Joi.object({
      type: Joi.string()
        .required()
        .valid(...acceptedTypes),
      lossStatus: Joi.string()
        .required()
        .valid(...acceptedLossStatuses),
      itemStocks: Joi.array().items(itemStockSchema).min(1).required(),
      policeNotified: Joi.string()
        .required()
        .valid(...acceptedPoliceNotified),
      policeStation: Joi.string().when("policeNotified", {
        is: "yes",
        then: Joi.required(),
        otherwise: Joi.optional().allow("", null),
      }),
      policeReportDate: Joi.string().when("policeNotified", {
        is: "yes",
        then: Joi.required(),
        otherwise: Joi.optional().allow("", null),
      }),
      attachment: Joi.string().optional().allow("", null),
      circumstances: Joi.string().required(),
      governmentId: Joi.string().required(),
      governmentIdNo: Joi.string().required(),
      governmentIdDate: Joi.string().required(),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _createLoss(payload);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `Error creating loss: ${error}` });
      next(error);
    }
  }

  async function getLosses(req: Request, res: Response, next: NextFunction) {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";
    const type = (req.params.type as string) || "";
    const status = (req.params.status as string) || "";

    const _user = req.headers.user as TKeyValuePair;

    const schema = Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().min(10).max(50).optional(),
      sort: Joi.object().optional(),
      search: Joi.string().allow("").optional(),
      type: Joi.string()
        .valid(...acceptedTypes)
        .required(),
      status: Joi.string()
        .valid(...acceptedFilterStatuses)
        .required(),
    });

    const { error } = schema.validate({ page, limit, sort, search, type, status });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const losses = await _getLosses({ page, limit, sort, search, type, userId: _user.user, role: _user.role, status });
      return res.json(losses);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getLossById(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const loss = await _getLossById(id);
      return res.json(loss);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function updateStatusToApproved(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _updateStatusToApproved(id);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `loss: ${error}` });
      next(error);
    }
  }

  async function updateStatusToCompleted(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _updateStatusToCompleted(id);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `loss: ${error}` });
      next(error);
    }
  }

  return {
    createLoss,
    getLosses,
    getLossById,
    updateStatusToApproved,
    updateStatusToCompleted,
  };
}
