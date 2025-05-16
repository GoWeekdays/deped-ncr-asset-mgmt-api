import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { BadRequestError, logger } from "@ph-deped-ncr/utils";
import { TKeyValuePair } from "./../local";
import useRISlipService from "./../services/ris.service";

export default function useRISlipController() {
  const {
    createRISlip: _createRISlip,
    getRISlips: _getRISlips,
    getReportRISlips: _getReportRISlips,
    getRISlipById: _getRISlipById,
    getReportRISlipById: _getReportRISlipById,
    updateRISlipById: _updateRISlipById,
    evaluateRISlipById: _evaluateRISlipById,
    issueRISlipById: _issueRISlipById,
    updateRISlipStatusById: _updateRISlipStatusById,
    incrementSerialNoCounter: _incrementSerialNoCounter,
  } = useRISlipService();
  const acceptedStatus = ["for-evaluation", "evaluating", "cancelled"];

  const itemStockSchema = Joi.object({
    assetId: Joi.string().hex().required(),
    requestQty: Joi.number().min(1).required(),
  });

  const evaluateItemStockSchema = Joi.object({
    assetId: Joi.string().hex().required(),
    issueQty: Joi.number().min(0).required(),
    remarks: Joi.string().optional().allow("", null),
  });

  async function createRISlip(req: Request, res: Response, next: NextFunction) {
    const payload = req.body;

    const schema = Joi.object({
      purpose: Joi.string().required(),
      itemStocks: Joi.array().items(itemStockSchema).min(1).required(),
      requestedBy: Joi.string().hex().required(),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _createRISlip(payload);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getRISlips(req: Request, res: Response, next: NextFunction) {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";

    const _user = req.headers.user as TKeyValuePair;

    const schema = Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().min(10).max(50).optional(),
      sort: Joi.object().optional(),
      search: Joi.string().allow("").optional(),
    });

    const { error } = schema.validate({ page, limit, sort, search });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const RISlips = await _getRISlips({ page, limit, sort, search, role: _user.role, user: _user.user });
      return res.json(RISlips);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getReportRISlips(req: Request, res: Response, next: NextFunction) {
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";

    const schema = Joi.object({
      sort: Joi.object().optional(),
      search: Joi.string().allow("").optional(),
    });

    const { error } = schema.validate({ sort, search });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      next(new BadRequestError(error.message));
    }

    try {
      const RISlips = await _getReportRISlips({ sort, search });
      return res.json(RISlips);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getRISlipById(req: Request, res: Response, next: NextFunction) {
    const _id = (req.params.id as string) || "";
    const _user = req.headers.user as TKeyValuePair;

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(_id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const RISlips = await _getRISlipById({ _id, role: _user.role });
      return res.json(RISlips);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getReportRISlipById(req: Request, res: Response, next: NextFunction) {
    const _id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(_id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const RISlips = await _getReportRISlipById({ _id });
      return res.json(RISlips);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function evaluateRISlipById(req: Request, res: Response, next: NextFunction) {
    const id = req.params.id as string;
    const payload = req.body;

    const schema = Joi.object({
      itemStocks: Joi.array().items(evaluateItemStockSchema).min(1).required(),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      payload.status = "for-review";
      const evaluatedRISlip = await _evaluateRISlipById(id, payload);
      return res.json({ message: "RIS evaluated successfully", ris: evaluatedRISlip });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function cancelRISlipById(req: Request, res: Response, next: NextFunction) {
    const id = req.params.id as string;
    const payload = req.body;

    const schema = Joi.object({
      remarks: Joi.string().required(),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      payload.status = "cancelled";
      const cancelledRISlip = await _updateRISlipById(id, payload);
      return res.json({ message: "RIS cancelled successfully", ris: cancelledRISlip });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function approveRISlipById(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";
    const payload = req.body;

    const schema = Joi.object({
      approvedBy: Joi.string().hex().required(),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      payload.status = "pending";
      payload.approvedAt = new Date().toISOString();

      const approvedRISlip = await _updateRISlipById(id, payload);
      return res.json({ message: "RIS is set to pending successfully", ris: approvedRISlip });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function issueRISlipById(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";
    const payload = req.body;

    const schema = Joi.object({
      issuedBy: Joi.string().hex().required(),
      receivedBy: Joi.string().hex().required(),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      payload.status = "issued";
      payload.completedAt = new Date().toISOString();

      const issuedRISlip = await _issueRISlipById(id, payload);
      return res.json({ message: "RIS is set to issued successfully", ris: issuedRISlip });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function updateRISlipStatusById(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";
    const status = (req.params.status as string) || "";

    const schema = Joi.object({
      id: Joi.string().hex().required(),
      status: Joi.string()
        .valid(...acceptedStatus)
        .required(),
    });

    const { error } = schema.validate({ id, status });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _updateRISlipStatusById(id, status);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function incrementSerialNoCounter(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const serialNo = await _incrementSerialNoCounter(id);
      return res.json({ serialNo });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  return {
    createRISlip,
    getRISlips,
    getReportRISlips,
    getRISlipById,
    getReportRISlipById,
    evaluateRISlipById,
    cancelRISlipById,
    approveRISlipById,
    issueRISlipById,
    updateRISlipStatusById,
    incrementSerialNoCounter,
  };
}
