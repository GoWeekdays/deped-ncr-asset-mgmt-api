import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { BadRequestError, logger } from "@ph-deped-ncr/utils";
import useReturnService from "./../services/return.service";
import { TKeyValuePair } from "./../local";

export default function useReturnController() {
  const {
    createReturn: _createReturn,
    getReturns: _getReturns,
    getReturnById: _getReturnById,
    updateReturnById: _updateReturnById,
    updateStatusToApproved: _updateStatusToApproved,
    updateStatusToCompleted: _updateStatusToCompleted,
  } = useReturnService();

  const acceptedTypes = ["SEP", "PPE"];
  const acceptedRemarks = ["for-reissue", "for-disposal"];

  const itemStockSchema = Joi.object({
    stockId: Joi.string().hex().required(),
  });

  const approveItemStockSchema = Joi.object({
    stockId: Joi.string().hex().required(),
    stockRemarks: Joi.string()
      .valid(...acceptedRemarks)
      .required(),
  });

  async function createReturn(req: Request, res: Response, next: NextFunction) {
    const payload = req.body;
    const schema = Joi.object({
      type: Joi.string()
        .valid(...acceptedTypes)
        .required(),
      itemStocks: Joi.array().items(itemStockSchema).min(1).required(),
      returnedBy: Joi.string().hex().required(),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _createReturn(payload);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `Create return error: ${error}` });
      next(error);
    }
  }

  async function getReturns(req: Request, res: Response, next: NextFunction) {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";
    const type = (req.params.type as string) || "";

    const _user = req.headers.user as TKeyValuePair;

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
      next(new BadRequestError(error.message));
    }

    try {
      const returns = await _getReturns({ page, limit, sort, search, type, userId: _user.user, role: _user.role });
      return res.json(returns);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getReturnById(req: Request, res: Response, next: NextFunction) {
    const _id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(_id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const returnSlip = await _getReturnById({ _id });
      return res.json(returnSlip);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function approveStatus(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";
    const payload = req.body;
    const schema = Joi.object({
      itemStocks: Joi.array().items(approveItemStockSchema).min(1).required(),
      approvedBy: Joi.string().hex().required(),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      payload.status = "approved";
      const message = await _updateStatusToApproved(id, payload);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function completeStatus(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";
    const payload = req.body;
    const schema = Joi.object({
      receivedBy: Joi.string().hex().required(),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      payload.status = "completed";
      const message = await _updateStatusToCompleted(id, payload);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  return {
    createReturn,
    getReturns,
    getReturnById,
    approveStatus,
    completeStatus,
  };
}
