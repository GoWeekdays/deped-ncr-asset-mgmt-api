import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { BadRequestError, logger } from "@ph-deped-ncr/utils";
import useDivisionService from "./../services/division.service";

export default function useDivisionController() {
  const {
    createDivision: _createDivision,
    getDivisions: _getDivisions,
    getDivisionById: _getDivisionById,
    updateDivision: _updateDivision,
    deleteDivision: _deleteDivision,
  } = useDivisionService();

  async function createDivision(req: Request, res: Response, next: NextFunction) {
    const name = (req.body.name as string) || "";
    const email = (req.body.email as string) || "";

    const schema = Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().required(),
    });

    const { error } = schema.validate({ name, email });
    if (error) {
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _createDivision({ name, email });
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getDivisions(req: Request, res: Response, next: NextFunction) {
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
      const divisions = await _getDivisions({ page, limit, sort, search });
      return res.json(divisions);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getDivisionById(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const data = await _getDivisionById(id);
      return res.json(data);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function updateDivision(req: Request, res: Response, next: NextFunction) {
    const id = req.params.id as string;
    const payload = req.body;
    const schema = Joi.object({
      name: Joi.string().optional().allow("", null),
      email: Joi.string().email().optional().allow("", null),
    });

    const { error } = schema.validate(payload);

    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _updateDivision(id, payload);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function deleteDivision(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _deleteDivision(id);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  return {
    createDivision,
    getDivisions,
    getDivisionById,
    updateDivision,
    deleteDivision,
  };
}
