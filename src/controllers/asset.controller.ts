import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { BadRequestError, logger } from "@ph-deped-ncr/utils";
import { TKeyValuePair } from "./../local";
import useAssetService from "./../services/asset.service";

export default function useAssetController() {
  const {
    createConsumable: _createConsumable,
    createProperty: _createProperty,
    getAssets: _getAssets,
    getAssetsForTransfer: _getAssetsForTransfer,
    getAssetsForReturn: _getAssetsForReturn,
    getAssetsForWaste: _getAssetsForWaste,
    getAssetById: _getAssetById,
    getAssetsForMaintenance: _getAssetsForMaintenance,
    getAssetsForDisposalReport: _getAssetsForDisposalReport,
    updateAssetById: _updateAssetById,
    deleteAssetById: _deleteAssetById,
    updatePropertyById: _updatePropertyById,
    updatePropertyConditionById: _updatePropertyConditionById,
    getAssetConsumables: _getAssetConsumables,
    getAssetSEPPPE: _getAssetSEPPPE,
  } = useAssetService();

  const acceptedTypes = ["consumable", "SEP", "PPE"];
  const acceptedConditions = ["good-condition", "reissued", "transfer", "returned", "for-disposal", "for-repair"];
  const acceptedModeOfAcquisition = ["procurement", "donation", "transfer"];
  const acceptedProcurementTypes = ["ps-dbm", "bidding", "quotation"];

  async function createConsumable(req: Request, res: Response, next: NextFunction) {
    const payload = req.body;

    const schema = Joi.object({
      createdAt: Joi.string().optional().allow("", null),
      name: Joi.string().required(),
      description: Joi.string().required(),
      unitOfMeasurement: Joi.string().optional().allow("", null),
      reorderPoint: Joi.string().required(),
      article: Joi.string().required(),
      cost: Joi.number().min(1).required(),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _createConsumable({ ...payload, type: "consumable" });
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function createProperty(req: Request, res: Response, next: NextFunction) {
    const payload = req.body;

    const schema = Joi.object({
      createdAt: Joi.string().optional().allow("", null),
      type: Joi.string().required().valid("SEP", "PPE"),
      name: Joi.string().required(),
      description: Joi.string().required(),
      unitOfMeasurement: Joi.string().optional().allow("", null),
      year: Joi.string().required(),
      propertyCode: Joi.string().required(),
      serialCode: Joi.string().required(),
      locationCode: Joi.string().required(),
      reference: Joi.string().required(),
      attachment: Joi.string().optional().allow("", null),
      quantity: Joi.number().min(1).required(),
      cost: Joi.number().when("type", {
        is: Joi.valid("SEP"),
        then: Joi.number().min(1).max(49999).required(),
        otherwise: Joi.number().min(50000).required(),
      }),
      modeOfAcquisition: Joi.string()
        .required()
        .valid(...acceptedModeOfAcquisition),
      procurementType: Joi.string()
        .valid(...acceptedProcurementTypes)
        .when("modeOfAcquisition", {
          is: "procurement",
          then: Joi.required(),
          otherwise: Joi.optional().allow("", null),
        }),
      supplier: Joi.string().when("procurementType", {
        is: Joi.valid("bidding", "quotation"),
        then: Joi.required(),
        otherwise: Joi.optional().allow("", null),
      }),
      officeId: Joi.string().hex().optional().allow(null, ""),
      article: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _createProperty(payload);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `Error creating property: ${error}` });
      next(error);
    }
  }

  async function getAssets(req: Request, res: Response, next: NextFunction) {
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
      const assets = await _getAssets({ page, limit, sort, search, type, role: _user.role });

      return res.json(assets);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getAssetsForTransfer(req: Request, res: Response, next: NextFunction) {
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
      type: Joi.string().required().valid("SEP", "PPE"),
    });

    const { error } = schema.validate({ page, limit, sort, search, type });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const assets = await _getAssetsForTransfer({ page, limit, sort, search, type, role: _user.role });
      return res.json(assets);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getAssetsForReturn(req: Request, res: Response, next: NextFunction) {
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
      type: Joi.string().required().valid("SEP", "PPE"),
    });

    const { error } = schema.validate({ page, limit, sort, search, type });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const assets = await _getAssetsForReturn({ page, limit, sort, search, type, role: _user.role, userId: _user.user });
      return res.json(assets);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getAssetsForWaste(req: Request, res: Response, next: NextFunction) {
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";

    const schema = Joi.object({
      sort: Joi.object().optional(),
      search: Joi.string().optional().allow(""),
    });

    const { error } = schema.validate({ sort, search });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    const _user = req.headers.user as TKeyValuePair;

    try {
      const items = await _getAssetsForWaste({ sort, search, role: _user.role });
      return res.json(items);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getAssetsForMaintenance(req: Request, res: Response, next: NextFunction) {
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";

    const schema = Joi.object({
      sort: Joi.object().optional(),
      search: Joi.string().optional().allow(""),
    });

    const { error } = schema.validate({ sort, search });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    const _user = req.headers.user as TKeyValuePair;

    try {
      const items = await _getAssetsForMaintenance({ sort, search, role: _user.role, userId: _user.user });
      return res.json(items);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getAssetsForDisposalReport(req: Request, res: Response, next: NextFunction) {
    const sort = req.query.sort || {};
    const type = (req.params.type as string) || "";

    const schema = Joi.object({
      sort: Joi.object().optional(),
      type: Joi.string().valid("SEP", "PPE").required(),
    });

    const { error } = schema.validate({ sort, type });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const assets = await _getAssetsForDisposalReport({ sort, type });
      return res.json(assets);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getAssetById(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const assets = await _getAssetById(id);
      return res.json(assets);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function updateAssetById(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";
    const payload = req.body;
    const schema = Joi.object({
      name: Joi.string().optional().allow("", null),
      description: Joi.string().optional().allow("", null),
      reorderPoint: Joi.string().optional().allow("", null),
      unitOfMeasurement: Joi.string().optional().allow("", null),
      article: Joi.string().optional().allow("", null),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _updateAssetById(id, payload);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function updatePropertyById(req: Request, res: Response, next: NextFunction) {
    const payload = req.body;
    const schema = Joi.object({
      _id: Joi.string().hex().required(),
      name: Joi.string().optional().allow("", null),
      description: Joi.string().optional().allow("", null),
      year: Joi.string().optional().allow("", null),
      propertyCode: Joi.string().optional().allow("", null),
      serialCode: Joi.string().optional().allow("", null),
      locationCode: Joi.string().optional().allow("", null),
      unitOfMeasurement: Joi.string().optional().allow("", null),
    });

    const { error } = schema.validate(payload);
    if (error) {
      return next(new BadRequestError(error.message));
    }

    const id = payload._id as string;
    delete payload._id;

    try {
      const message = await _updatePropertyById(id, payload);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function updatePropertyConditionById(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";
    const condition = (req.params.condition as string) || "";

    const schema = Joi.object({
      id: Joi.string().hex().required(),
      condition: Joi.string()
        .valid(...acceptedConditions)
        .required(),
    });

    const { error } = schema.validate({ id, condition });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      next(new BadRequestError(error.message));
    }

    try {
      const message = await _updatePropertyConditionById(id, condition);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function deleteAssetById(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _deleteAssetById(id);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getAssetConsumables(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await _getAssetConsumables();
      return res.json(items);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getAssetSEPPPE(req: Request, res: Response, next: NextFunction) {
    try {
      const type = (req.params.type as string) || "";
      const search = (req.query.search as string) || "";
      const condition = (req.query.condition as string) || "";

      const schema = Joi.object({
        type: Joi.string().valid("SEP", "PPE").required(),
        search: Joi.string().optional().allow(null, ""),
        condition: Joi.string().valid("good-condition", "reissued", "returned").optional().allow(null, ""),
      });

      const { error } = schema.validate({ type, search, condition });
      if (error) {
        logger.log({ level: "error", message: `${error}` });
        return next(new BadRequestError(error.message));
      }

      const items = await _getAssetSEPPPE(type, search, condition);
      return res.json(items);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  return {
    createConsumable,
    createProperty,
    getAssets,
    getAssetsForTransfer,
    getAssetsForReturn,
    getAssetsForWaste,
    getAssetsForMaintenance,
    getAssetsForDisposalReport,
    getAssetById,
    getAssetConsumables,
    getAssetSEPPPE,
    updateAssetById,
    updatePropertyById,
    updatePropertyConditionById,
    deleteAssetById,
  };
}
