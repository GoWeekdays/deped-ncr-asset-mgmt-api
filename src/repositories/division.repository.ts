import { ObjectId } from "mongodb";
import { BadRequestError, logger, paginate, useAtlas } from "@ph-deped-ncr/utils";
import { MDivision, TDivision } from "./../models/division.model";

export default function useDivisionRepository() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("divisions");

  async function createIndex() {
    try {
      await collection.createIndexes([{ key: { deletedAt: 1 } }, { key: { name: 1, deletedAt: 1 } }]);

      return "Successfully created index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createSearchIndex() {
    try {
      await collection.createIndex({ name: "text", email: "text" }, { name: "TextSearch" });

      return "Successfully created search index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createUniqueIndex() {
    try {
      await collection.createIndex({ name: 1, deletedAt: 1 }, { name: "UniqueName", unique: true });
      await collection.createIndex({ email: 1, deletedAt: 1 }, { name: "UniqueEmail", unique: true });

      return "Successfully created unique index.";
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createDivision(value: TDivision) {
    const division = new MDivision(value);

    try {
      const existingName = await collection.findOne({ name: value.name, deletedAt: null });
      if (existingName) {
        throw new BadRequestError("Division name already exists.");
      }

      const existingEmail = await collection.findOne({ email: value.email, deletedAt: null });
      if (existingEmail) {
        throw new BadRequestError("Division email already exists.");
      }

      return await collection.insertOne(division);
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });

      const isDuplicated = error.message.includes("duplicate");
      const isEmailDuplicated = error.message.includes("email");
      const isNameDuplicated = error.message.includes("name");

      if (isDuplicated && isEmailDuplicated) {
        throw new BadRequestError("Division email already exists.");
      }

      if (isDuplicated && isNameDuplicated) {
        throw new BadRequestError("Division name already exists.");
      }

      throw error;
    }
  }

  async function getDivisions({ page = 1, limit = 10, sort = {}, search = "" } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: any = { deletedAt: null };

    sort = Object.keys(sort).length > 0 ? sort : { name: 1 };

    if (search) {
      query.$text = { $search: search };
    }

    const pipeLine = [{ $match: query }];

    const pipelineForItems = [...pipeLine, { $sort: sort }, { $skip: page * limit }, { $limit: limit }];
    const pipelineForCount = [...pipeLine, { $count: "totalCount" }];

    try {
      const items = await collection.aggregate(pipelineForItems).toArray();
      const countResult = await collection.aggregate(pipelineForCount).toArray();
      const length = countResult.length > 0 ? countResult[0].totalCount : 0;

      return paginate(items, page, limit, length);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getDivisionById(_id: string | ObjectId) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      return await collection.findOne({ _id, deletedAt: null });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateDivision(_id: string | ObjectId, value: TDivision) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      const existingName = await collection.findOne({ name: value.name, _id: { $ne: _id }, deletedAt: null });
      if (existingName) {
        throw new BadRequestError("Division name already exists.");
      }

      const existingEmail = await collection.findOne({ email: value.email, _id: { $ne: _id }, deletedAt: null });
      if (existingEmail) {
        throw new BadRequestError("Division email already exists.");
      }

      value.updatedAt = new Date().toISOString();

      await collection.updateOne({ _id }, { $set: value });
      return "Successfully updated division.";
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });

      const isDuplicated = error.message.includes("duplicate");
      const isNameDuplicated = error.message.includes("name");
      const isEmailDuplicated = error.message.includes("email");

      if (isDuplicated && isNameDuplicated) {
        throw new BadRequestError("Division name already exists");
      }

      if (isDuplicated && isEmailDuplicated) {
        throw new BadRequestError("Division email already exists");
      }

      throw error;
    }
  }

  async function deleteDivision(_id: string | ObjectId) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      await collection.updateOne({ _id }, { $set: { deletedAt: new Date().toISOString() } });
      return "Successfully deleted division.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return { createIndex, createSearchIndex, createUniqueIndex, createDivision, getDivisions, updateDivision, deleteDivision, getDivisionById };
}
