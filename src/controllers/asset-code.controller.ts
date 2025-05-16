import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { BadRequestError, logger } from "@ph-deped-ncr/utils";
import useAssetCodeService from "./../services/asset-code.service";

export default function useAssetCodeController() {
  const {
    createAssetCode: _createAssetCode,
    getAssetCodesByType: _getAssetCodesByType,
    updateAssetCodeById: _updateAssetCodeById,
    deleteAssetCode: _deleteAssetCode,
  } = useAssetCodeService();

  const acceptedTypes = ["serial-code", "sep-code", "ppe-code", "location-code"];

  async function createAssetCode(req: Request, res: Response, next: NextFunction) {
    const type = (req.body.type as string) || "";
    const code = (req.body.code as string) || "";
    const value = (req.body.value as string) || "";
    const year = typeof req.body.year === "string" ? Number(req.body.year) : req.body.year;

    const schema = Joi.object({
      type: Joi.string()
        .required()
        .valid(...acceptedTypes),
      code: Joi.string().required(),
      value: Joi.string().required(),
      year: Joi.number()
        .min(0)
        .when("type", {
          is: "ppe-code",
          then: Joi.required(),
          otherwise: Joi.optional().allow(0, null),
        }),
    });

    const payload = { type, code, value, year };

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _createAssetCode(payload);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getAssetCodesByType(req: Request, res: Response, next: NextFunction) {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";
    const type = (req.params.type as string) || "";

    const schema = Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().optional(),
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
      const assetCodes = await _getAssetCodesByType({ page, limit, sort, search, type });
      return res.json(assetCodes);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function updateAssetCodeById(req: Request, res: Response, next: NextFunction) {
    const id = req.params.id as string;
    const code = (req.body.code as string) || "";
    const value = (req.body.value as string) || "";
    const year = typeof req.body.year === "string" ? Number(req.body.year) : req.body.year;

    const schema = Joi.object({
      code: Joi.string().optional().allow("", null),
      value: Joi.string().optional().allow("", null),
      year: Joi.number().min(0).optional().allow(0, null),
    });

    const payload = { code, value, year };

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _updateAssetCodeById({ _id: id, value: payload });
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function deleteAssetCode(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _deleteAssetCode(id);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  return {
    createAssetCode,
    getAssetCodesByType,
    updateAssetCodeById,
    deleteAssetCode,
  };
}
