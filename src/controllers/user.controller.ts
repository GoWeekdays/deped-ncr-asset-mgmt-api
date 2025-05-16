import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { AppError, BadRequestError, InternalServerError, logger } from "@ph-deped-ncr/utils";
import { useUserService } from "./../services/user.service";

export function useUserController() {
  const {
    createUserWithInvite: _createUserWithInvite,
    getUsers: _getUsers,
    getUsersByType: _getUsersByType,
    getUserById: _getUserById,
    updateUser: _updateUser,
    updateUserStatus,
    deleteUser: _deleteUser,
    updateOldPassword,
    getPersonnelList: _getPersonnelList,
  } = useUserService();

  const acceptedTypes = ["admin-head", "admin", "office-chief", "personnel"];
  const acceptedStatuses = ["active", "suspended"];

  async function createUserWithInvite(req: Request, res: Response, next: NextFunction) {
    const otp = (req.body.otp as string) || "";
    const password = (req.body.password as string) || "";
    const passwordConfirmation = (req.body.passwordConfirmation as string) || "";
    const title = (req.body.title as string) || "";
    const firstName = (req.body.firstName as string) || "";
    const middleName = (req.body.middleName as string) || "";
    const lastName = (req.body.lastName as string) || "";
    const suffix = (req.body.suffix as string) || "";
    const designation = (req.body.designation as string) || "";

    const schema = Joi.object({
      otp: Joi.string().hex().required(),
      password: Joi.string().min(8).required(),
      passwordConfirmation: Joi.string().min(8).required().valid(Joi.ref("password")).messages({ "any.only": "Passwords do not match." }),
      title: Joi.string().allow("").optional(),
      firstName: Joi.string().required(),
      middleName: Joi.string().allow("").optional(),
      lastName: Joi.string().required(),
      suffix: Joi.string().allow("").optional(),
      designation: Joi.string().required(),
    });

    const { error } = schema.validate({ otp, password, passwordConfirmation, title, firstName, middleName, lastName, suffix, designation });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _createUserWithInvite({
        otp,
        value: { password, title, firstName, middleName, lastName, suffix, designation },
      });

      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getUsers(req: Request, res: Response, next: NextFunction) {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort || {};
    const search = (req.query.search as string) || "";

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
      const users = await _getUsers({ page, limit, sort, search });
      return res.json(users);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getUsersByType(req: Request, res: Response, next: NextFunction) {
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
      type: Joi.string().required(),
    });

    const { error } = schema.validate({ page, limit, sort, search, type });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const users = await _getUsersByType({ page, limit, sort, search, type });
      return res.json(users);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getUserById(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const user = await _getUserById(id);
      return res.json(user);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function updateUser(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";
    const title = (req.body.title as string) || "";
    const firstName = (req.body.firstName as string) || "";
    const middleName = (req.body.middleName as string) || "";
    const lastName = (req.body.lastName as string) || "";
    const suffix = (req.body.suffix as string) || "";
    const type = (req.body.type as string) || "";
    const designation = (req.body.designation as string) || "";
    const officeId = (req.body.officeId as string) || "";
    const divisionId = (req.body.divisionId as string) || "";
    const attachment = (req.body.attachment as string) || "";
    const status = (req.body.status as string) || "";

    const schema = Joi.object({
      id: Joi.string().hex().required(),
      title: Joi.string().allow("").optional(),
      firstName: Joi.string().allow("").optional(),
      middleName: Joi.string().allow("").optional(),
      lastName: Joi.string().allow("").optional(),
      suffix: Joi.string().allow("").optional(),
      type: Joi.string()
        .valid(...acceptedTypes)
        .optional(),
      designation: Joi.string().allow("").optional(),
      officeId: Joi.string().allow("").optional(),
      divisionId: Joi.string().allow("").optional(),
      attachment: Joi.string().allow("").optional(),
      status: Joi.string()
        .valid(...acceptedStatuses)
        .optional(),
    });

    const { error } = schema.validate({
      id,
      title,
      firstName,
      middleName,
      lastName,
      suffix,
      type,
      designation,
      officeId,
      divisionId,
      attachment,
      status,
    });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await _updateUser(id, {
        title,
        firstName,
        middleName,
        lastName,
        suffix,
        type,
        designation,
        officeId,
        divisionId,
        attachment,
        status,
      });

      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function suspendUser(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${schema.error}` });
      return next(new BadRequestError(`${error.message}`));
    }

    try {
      await updateUserStatus(id, "suspended");
      return res.json({ message: "Successfully suspended user." });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function deleteUser(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";

    const schema = Joi.string().hex().required();

    const { error } = schema.validate(id);
    if (error) {
      logger.log({ level: "error", message: `${schema.error}` });
      return next(new BadRequestError(`${error.message}`));
    }

    try {
      await _deleteUser(id);
      return res.json({ message: "Successfully deleted user." });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function updatePassword(req: Request, res: Response, next: NextFunction) {
    const id = (req.params.id as string) || "";
    const oldPassword = (req.body.oldPassword as string) || "";
    const newPassword = (req.body.newPassword as string) || "";
    const passwordConfirmation = (req.body.passwordConfirmation as string) || "";

    const schema = Joi.object({
      id: Joi.string().hex().required(),
      oldPassword: Joi.string().required(),
      newPassword: Joi.string().required(),
      passwordConfirmation: Joi.string().min(8).required().valid(Joi.ref("newPassword")).messages({ "any.only": "Passwords do not match." }),
    });

    const { error } = schema.validate({ id, oldPassword, newPassword, passwordConfirmation });
    if (error) {
      logger.log({ level: "error", message: `${error}` });
      return next(new BadRequestError(error.message));
    }

    try {
      const message = await updateOldPassword(id, oldPassword, newPassword);
      return res.json({ message });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  async function getPersonnelList(req: Request, res: Response, next: NextFunction) {
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
      const users = await _getPersonnelList({ page, limit, sort, search });
      return res.json(users);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      next(error);
    }
  }

  return {
    createUserWithInvite,
    getUsers,
    getUsersByType,
    getUserById,
    updateUser,
    suspendUser,
    deleteUser,
    updatePassword,
    getPersonnelList,
  };
}
