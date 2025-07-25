import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { BadRequestError, logger } from "@ph-deped-ncr/utils";
import useStockService from "./../services/stock.service";
import { TKeyValuePair } from "./../local";

export default function useStockController() {
  const {
    createStock: _createStock,
    createStockByBatch: _createStockByBatch,
    getStockById: _getStockById,
    getStocksByAssetId: _getStocksByAssetId,
    getStocksByCondition: _getStocksByCondition,
    getIssuedStocksForLoss: _getIssuedStocksForLoss,
    getIssuedStocksForReturn: _getIssuedStocksForReturn,
    getStocksByWasteCondition: _getStocksByWasteCondition,
    getIssuedStocksForMaintenance: _getIssuedStocksForMaintenance,
    getPropertyByOfficeId: _getPropertyByOfficeId,
    getPersonnelStockCardById: _getPersonnelStockCardById,
  } = useStockService();

  const acceptedTypes = ["consumable", "SEP", "PPE"];
  const acceptedTransferConditions = ["good-condition", "issued", "returned"];

  async function createStock(req: Request, res: Response, next: NextFunction) {
    const schema = Joi.object({
      assetId: Joi.string().hex().required(),
      reference: Joi.string().required(),
      attachment: Joi.string().optional().allow(null, ""),
      officeId: Joi.string().hex().optional().allow(null, ""),
      ins: Joi.number().optional().allow(0),
      outs: Joi.number().optional().allow(0),
      numberOfDaysToConsume: Joi.number().optional().allow(0, null),
    });

    try {
      const { error } = schema.validate(req.body);
      if (error) {
        logger.log({ level: "error", message: `${error}` });
        return next(new BadRequestError(error.message));
      }

      const message = await _createStock(req.body);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function createStockByBatch(req: Request, res: Response, next: NextFunction) {
    const schema = Joi.object({
      reference: Joi.string().required(),
      attachment: Joi.string().optional().allow("", null),
      officeId: Joi.string().hex().optional().allow(null, ""),
      items: Joi.array()
        .items(
          Joi.object({
            id: Joi.string().required(),
            qty: Joi.number().required(),
            numberOfDaysToConsume: Joi.number().optional().allow(0, null),
          }),
        )
        .required(),
    });

    try {
      const { error } = schema.validate(req.body);
      if (error) {
        logger.log({ level: "error", message: `${error}` });
        return next(new BadRequestError(error.message));
      }

      const message = await _createStockByBatch(req.body);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(error);
    }
  }

  async function getStockById(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const transfer = await _getStockById(id);
      return res.json(transfer);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getStocksByAssetId(req: Request, res: Response, next: NextFunction) {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";
    const asset = (req.params.asset as string) || "";

    const schema = Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().optional(),
      sort: Joi.object().optional(),
      search: Joi.string().allow("").optional(),
      type: Joi.string()
        .valid(...acceptedTypes)
        .allow("")
        .optional(),
      asset: Joi.string().hex().optional().allow(null, ""),
    });

    const { error } = schema.validate({ page, limit, sort, search, asset });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const stocks = await _getStocksByAssetId({ page, limit, sort, search, asset });
      return res.json(stocks);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getStocksByCondition(req: Request, res: Response, next: NextFunction) {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";
    const asset = (req.params.asset as string) || "";
    const condition = (req.params.condition as string) || "";

    const schema = Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().optional(),
      sort: Joi.object().optional(),
      search: Joi.string().allow("").optional(),
      asset: Joi.string().hex().required(),
      condition: Joi.string()
        .valid(...acceptedTransferConditions)
        .required(),
    });

    const { error } = schema.validate({ page, limit, sort, search, asset, condition });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const stocks = await _getStocksByCondition({ page, limit, sort, search, asset, condition });
      return res.json(stocks);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getIssuedStocksForLoss(req: Request, res: Response, next: NextFunction) {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";
    const issueSlipId = (req.params.issueSlipId as string) || "";

    const schema = Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().optional(),
      sort: Joi.object().optional(),
      search: Joi.string().allow("").optional(),
      issueSlipId: Joi.string().hex().required(),
    });

    const { error } = schema.validate({ page, limit, sort, search, issueSlipId });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const stocks = await _getIssuedStocksForLoss({ page, limit, sort, search, issueSlipId });
      return res.json(stocks);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getIssuedStocksForReturn(req: Request, res: Response, next: NextFunction) {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";
    const assetId = (req.params.assetId as string) || "";

    const schema = Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().optional(),
      sort: Joi.object().optional(),
      search: Joi.string().allow("").optional(),
      assetId: Joi.string().hex().required(),
    });

    const { error } = schema.validate({ page, limit, sort, search, assetId });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const stocks = await _getIssuedStocksForReturn({ page, limit, sort, search, assetId });
      return res.json(stocks);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getStocksByWasteCondition(req: Request, res: Response, next: NextFunction) {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";
    const assetId = (req.params.assetId as string) || "";
    const condition = (req.params.condition as string) || "";

    const schema = Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().optional(),
      sort: Joi.object().optional(),
      search: Joi.string().allow("").optional(),
      assetId: Joi.string().hex().required(),
      condition: Joi.string()
        .valid(...acceptedTransferConditions)
        .required(),
    });

    const { error } = schema.validate({ page, limit, sort, search, assetId, condition });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const stocks = await _getStocksByWasteCondition({ page, limit, sort, search, assetId, condition });
      return res.json(stocks);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getIssuedStocksForMaintenance(req: Request, res: Response, next: NextFunction) {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";
    const assetId = (req.params.assetId as string) || "";

    const schema = Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().optional(),
      sort: Joi.object().optional(),
      search: Joi.string().allow("").optional(),
      assetId: Joi.string().hex().required(),
    });

    const _user = req.headers.user as TKeyValuePair;

    const { error } = schema.validate({ page, limit, sort, search, assetId });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const stocks = await _getIssuedStocksForMaintenance({ page, limit, sort, search, assetId, role: _user.role, userId: _user.user });
      return res.json(stocks);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getPropertyByOfficeId(req: Request, res: Response, next: NextFunction) {
    const officeId = (req.params.officeId as string) || "";
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) || 10;
    const search = (req.query.search as string) || "";

    const schema = Joi.object({
      officeId: Joi.string().hex().required(),
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().optional(),
      search: Joi.string().allow("").optional(),
    });

    const { error } = schema.validate({ officeId, page, limit, search });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const office = await _getPropertyByOfficeId({ officeId, page, limit, search });
      return res.json(office);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getPersonnelStockCardById(req: Request, res: Response, next: NextFunction) {
    const userId = (req.params.userId as string) || "";
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) || 10;
    const search = (req.query.search as string) || "";

    const schema = Joi.object({
      userId: Joi.string().hex().required(),
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().optional(),
      search: Joi.string().allow("").optional(),
    });

    const { error } = schema.validate({ userId, page, limit, search });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const result = await _getPersonnelStockCardById({ userId, page, limit, search });
      return res.json(result);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  return {
    createStock,
    createStockByBatch,
    getStockById,
    getStocksByAssetId,
    getStocksByCondition,
    getIssuedStocksForLoss,
    getIssuedStocksForReturn,
    getStocksByWasteCondition,
    getIssuedStocksForMaintenance,
    getPropertyByOfficeId,
    getPersonnelStockCardById,
  };
}
