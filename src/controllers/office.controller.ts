import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { BadRequestError, logger } from "@ph-deped-ncr/utils";
import useOfficeService from "./../services/office.service";

export default function useOfficeController() {
  const {
    createOffice: _createOffice,
    getOffices: _getOffices,
    getOfficeById: _getOfficeById,
    updateOffice: _updateOffice,
    deleteOffice: _deleteOffice,
    getOfficeNames: _getOfficeNames,
    getOfficesWithoutOfficeChief: _getOfficesWithoutOfficeChief,
  } = useOfficeService();

  async function createOffice(req: Request, res: Response, next: NextFunction) {
    const name = (req.body.name as string) || "";
    const email = (req.body.email as string) || "";
    const divisionId = (req.body.divisionId as string) ?? "";

    const schema = Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().optional().allow(null, ""),
      divisionId: Joi.string().hex().optional().allow(null, ""),
    });

    const { error } = schema.validate({ name, email, divisionId });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _createOffice({ name, email, divisionId });
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getOffices(req: Request, res: Response, next: NextFunction) {
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
      const offices = await _getOffices({ page, limit, sort, search });
      return res.json(offices);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getOfficeById(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const offices = await _getOfficeById(id);
      return res.json(offices);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function updateOffice(req: Request, res: Response, next: NextFunction) {
    const id = req.params.id as string;
    const payload = req.body;
    const schema = Joi.object({
      name: Joi.string().optional().allow("", null),
      email: Joi.string().email().optional().allow("", null),
      divisionId: Joi.string().hex().optional().allow(null, ""),
    });

    const { error } = schema.validate(payload);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _updateOffice(id, payload);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function deleteOffice(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _deleteOffice(id);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getOfficeNames(req: Request, res: Response, next: NextFunction) {
    try {
      const search = (req.query.search as string) || "";

      const schema = Joi.string().allow("").optional();

      const { error } = schema.validate(search);
      if (error) {
        return next(new BadRequestError(error.message));
      }

      const offices = await _getOfficeNames(search);
      return res.json(offices);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getOfficesWithoutOfficeChief(req: Request, res: Response, next: NextFunction) {
    try {
      const type = req.query.type as string;

      const schema = Joi.object({
        type: Joi.string().optional().allow(null, ""),
      });

      const { error } = schema.validate(req.query);
      if (error) {
        return next(new BadRequestError(error.message));
      }

      const offices = await _getOfficesWithoutOfficeChief(type);
      return res.json({ items: offices });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  return {
    createOffice,
    getOffices,
    getOfficeById,
    updateOffice,
    deleteOffice,
    getOfficeNames,
    getOfficesWithoutOfficeChief,
  };
}
