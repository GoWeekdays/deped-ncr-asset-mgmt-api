import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { BadRequestError, logger } from "@ph-deped-ncr/utils";
import useIssueSlipService from "./../services/issue-slip.service";
import { TKeyValuePair } from "./../local";

export default function useIssueSlipController() {
  const {
    createIssueSlip: _createIssueSlip,
    getIssueSlips: _getIssueSlips,
    getIssueSlipsByReceiver: _getIssueSlipsByReceiver,
    getIssueSlipById: _getIssueSlipById,
    updateStatusToIssued: _updateStatusToIssued,
  } = useIssueSlipService();

  const acceptedTypes = ["ICS", "PAR"];

  async function createIssueSlip(req: Request, res: Response, next: NextFunction) {
    const schema = Joi.object({
      type: Joi.string()
        .valid(...acceptedTypes)
        .required(),
      assetId: Joi.string().hex().required(),
      quantity: Joi.number().min(1).required(),
      estimatedUsefulLife: Joi.number().optional().allow(0, null),
      serialNo: Joi.array().items(Joi.string()).optional().default([]).allow(null),
      remarks: Joi.string().optional().allow(null, ""),
      issuedBy: Joi.string().hex().optional().allow(null, ""),
      receivedBy: Joi.string().hex().optional().allow(null, ""),
      receivedAt: Joi.string().optional().allow(null, ""),
    });

    try {
      const { error } = schema.validate(req.body);
      if (error) {
        logger.log({ level: "error", message: `${error}` });
        return next(new BadRequestError(error.message));
      }

      const message = await _createIssueSlip(req.body);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getIssueSlips(req: Request, res: Response, next: NextFunction) {
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
      return next(new BadRequestError(error.message));
    }

    try {
      const issueSlips = await _getIssueSlips({ page, limit, sort, search, type, userId: _user.user, role: _user.role });
      return res.json(issueSlips);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getIssueSlipsByReceiver(req: Request, res: Response, next: NextFunction) {
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

    const _user = req.headers.user as TKeyValuePair;

    const { error } = schema.validate({ page, limit, sort, search, type });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const issueSlips = await _getIssueSlipsByReceiver({ page, limit, sort, search, type, receivedBy: _user.user });
      return res.json(issueSlips);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getIssueSlipById(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const issueSlips = await _getIssueSlipById(id);
      return res.json(issueSlips);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function updateStatusToIssued(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }
    try {
      const result = await _updateStatusToIssued(id);
      return res.json({ message: result });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  return {
    createIssueSlip,
    getIssueSlips,
    getIssueSlipsByReceiver,
    getIssueSlipById,
    updateStatusToIssued,
  };
}
