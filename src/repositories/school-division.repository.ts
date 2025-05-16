import { ObjectId } from "mongodb";
import { BadRequestError, logger, paginate, useAtlas } from "@ph-deped-ncr/utils";
import { MSchoolDivision, TSchoolDivision } from "./../models/school-division.model";

export default function useSchoolDivisionRepository() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("schoolDivisions");

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
      await collection.createIndex({ name: "text" }, { name: "TextSearch" });

      return "Successfully created search index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createUniqueIndex() {
    try {
      await collection.createIndex({ name: 1, deletedAt: 1 }, { name: "UniqueName", unique: true });

      return "Successfully created unique index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createSchoolDivision(value: TSchoolDivision) {
    const schoolDivision = new MSchoolDivision(value);

    try {
      const existingName = await collection.findOne({ name: value.name, deletedAt: null });
      if (existingName) {
        throw new BadRequestError("School division name already exists.");
      }

      await collection.insertOne(schoolDivision);
      return "Successfully created school division.";
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });

      const isDuplicated = error.message.includes("duplicate");
      if (isDuplicated) {
        throw new BadRequestError("School division name already exists.");
      }

      throw error;
    }
  }

  async function getSchoolDivisions({ page = 1, limit = 10, sort = {}, search = "" } = {}) {
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

  async function getSchoolDivisionById(_id: string | ObjectId) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      const data = await collection.findOne({ _id, deletedAt: null });

      return data;
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateSchoolDivision(_id: string | ObjectId, value: TSchoolDivision) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      const existingName = await collection.findOne({ name: value.name, _id: { $ne: _id }, deletedAt: null });
      if (existingName) {
        throw new BadRequestError("School division name already exists.");
      }

      value.updatedAt = new Date().toISOString();

      await collection.updateOne({ _id }, { $set: value });
      return "Successfully updated school division.";
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });

      const isDuplicated = error.message.includes("duplicate");
      if (isDuplicated) {
        throw new BadRequestError("School division name already exists.");
      }

      throw error;
    }
  }

  async function deleteSchoolDivision(_id: string | ObjectId) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      await collection.updateOne({ _id }, { $set: { deletedAt: new Date().toISOString() } });
      return "Successfully deleted school division.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createIndex,
    createSearchIndex,
    createUniqueIndex,
    createSchoolDivision,
    getSchoolDivisions,
    getSchoolDivisionById,
    updateSchoolDivision,
    deleteSchoolDivision,
  };
}
