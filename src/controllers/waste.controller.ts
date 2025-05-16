import useWasteService from "./../services/waste.service";
import { EWasteType } from "./../models/waste.model";
import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { BadRequestError, logger } from "@ph-deped-ncr/utils";

export default function useWasteController() {
  const { createWaste: _createWaste, getWastes: _getWastes, getWasteById: _getWasteById, updateWasteById: _updateWasteById } = useWasteService();

  const itemStockSchema = Joi.object({
    stockId: Joi.string().hex().required(),
    type: Joi.string()
      .valid(...Object.values(EWasteType))
      .optional(),
    remarks: Joi.string().optional().allow(""),
    transferredTo: Joi.string().when("type", {
      is: "transferred-without-cost",
      then: Joi.required(),
      otherwise: Joi.optional().allow("", null),
    }),
  });

  async function createWaste(req: Request, res: Response, next: NextFunction) {
    const payload = req.body;

    const schema = Joi.object({
      placeOfStorage: Joi.string().required(),
      itemStocks: Joi.array().items(itemStockSchema).min(1).required(),
      certifiedBy: Joi.string().hex().required(),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _createWaste(payload);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getWastes(req: Request, res: Response, next: NextFunction) {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";

    const schema = Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().optional(),
      sort: Joi.object().optional(),
      search: Joi.string().allow("").optional(),
    });

    const { error } = schema.validate({ page, limit, sort, search });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const wastes = await _getWastes({ page, limit, sort, search });
      return res.json(wastes);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getWasteById(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const waste = await _getWasteById(id);
      return res.json(waste);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function updateWasteById(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";
    const payload = req.body;

    const schema = Joi.object({
      disposalApprovedBy: Joi.string().hex().required(),
      witnessedByName: Joi.string().optional().allow(""),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _updateWasteById(id, payload);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  return { createWaste, getWastes, getWasteById, updateWasteById };
}
