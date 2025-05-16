import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { BadRequestError, logger } from "@ph-deped-ncr/utils";
import useTransferService from "./../services/transfer.service";

export default function useTransferController() {
  const {
    createTransfer: _createTransfer,
    getTransfers: _getTransfers,
    getTransferById: _getTransferById,
    updateTransferById: _updateTransferById,
    updateStatusToCompleted: _updateStatusToCompleted,
  } = useTransferService();

  const acceptedTypes = ["inventory-transfer-report", "property-transfer-report"];

  const itemStockSchema = Joi.object({
    stockId: Joi.string().hex().required(),
  });

  async function createTransfer(req: Request, res: Response, next: NextFunction) {
    const payload = req.body;

    const schema = Joi.object({
      type: Joi.string()
        .valid(...acceptedTypes)
        .required(),
      transferReason: Joi.string().required(),
      transferType: Joi.string().required(),
      itemStocks: Joi.array().items(itemStockSchema).min(1).required(),
      from: Joi.string().required(),
      divisionId: Joi.string().hex().required(),
      school: Joi.string().allow("").optional(),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _createTransfer(payload);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getTransfers(req: Request, res: Response, next: NextFunction) {
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
      const transfers = await _getTransfers({ page, limit, sort, search, type });
      return res.json(transfers);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getTransferById(req: Request, res: Response, next: NextFunction) {
    const _id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(_id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const transfer = await _getTransferById({ _id });
      return res.json(transfer);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function approveStatus(req: Request, res: Response, next: NextFunction) {
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
      payload.status = "approved";
      const approvedTransfer = await _updateTransferById(id, payload);
      return res.json({ message: "Transfer is set to approved successfully", transfer: approvedTransfer });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function completeStatus(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";
    const payload = req.body;

    const schema = Joi.object({
      issuedBy: Joi.string().hex().required(),
      receivedByName: Joi.string().required(),
      receivedByDesignation: Joi.string().required(),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      payload.status = "completed";
      const completedTransfer = await _updateStatusToCompleted(id, payload);
      return res.json({ message: "Transfer is set to completed successfully", transfer: completedTransfer });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  return {
    createTransfer,
    getTransfers,
    getTransferById,
    approveStatus,
    completeStatus,
  };
}
