import { ObjectId } from "mongodb";
import { BadRequestError, logger, NotFoundError, paginate, useAtlas } from "@ph-deped-ncr/utils";
import { TKeyValuePair } from "./../local";
import { MAssetCode, TAssetCode } from "./../models/asset-code.model";

export default function useAssetCodeRepository() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("assetCodes");

  async function createIndex() {
    try {
      await collection.createIndexes([{ key: { type: 1, deletedAt: 1 } }, { key: { code: 1 } }]);

      return "Successfully created index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createSearchIndex() {
    try {
      await collection.createIndex({ value: "text", code: "text" }, { name: "TextSearch" });

      return "Successfully created search index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createUniqueIndex() {
    try {
      await collection.createIndex({ type: 1, code: 1, deletedAt: 1 }, { name: "UniqueIndex", unique: true });

      return "Successfully created unique index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createAssetCode(value: TAssetCode) {
    const assetCode = new MAssetCode(value);

    try {
      const existingCode = await collection.findOne({ type: value.type, code: value.code, deletedAt: null });
      if (existingCode) {
        throw new BadRequestError("Code already exists.");
      }

      await collection.insertOne(assetCode);
      return "Successfully created code.";
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });

      const isDuplicated = error.message.includes("duplicate");
      if (isDuplicated) {
        throw new BadRequestError("Code already exists.");
      }

      throw error;
    }
  }

  async function getAssetCodesByType({ page = 1, limit = 10, sort = {}, search = "", type = "" } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: TKeyValuePair = { type, deletedAt: null };

    sort = Object.keys(sort).length > 0 ? sort : { code: 1 };

    if (search) {
      query.$text = { $search: search };
    }

    type TProject = {
      type: number;
      code: number;
      value: number;
      year?: number;
    };

    const project: TProject = {
      type: 1,
      code: 1,
      value: 1,
      ...(type === "ppe-code" && { year: 1 }),
    };

    const pipeLine = [{ $match: query }];

    const pipelineForItems = [...pipeLine, { $project: project }, { $sort: sort }, { $skip: page * limit }, { $limit: limit }];
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

  async function updateAssetCodeById({ _id, value } = {} as { _id: string | ObjectId; value: TAssetCode }) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      const existingCode = await collection.findOne({ type: value.type, code: value.code, _id: { $ne: _id }, deletedAt: null });
      if (existingCode) {
        throw new BadRequestError("Code already exists.");
      }

      value.updatedAt = new Date().toISOString();

      const result = await collection.updateOne({ _id }, { $set: value });
      if (result.matchedCount === 0) {
        throw new NotFoundError("Code not found.");
      }

      return "Successfully updated code.";
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });

      const isDuplicated = error.message.includes("duplicate");
      if (isDuplicated) {
        throw new BadRequestError("Code already exists.");
      }

      throw error;
    }
  }

  async function deleteAssetCode(_id: string | ObjectId) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      await collection.updateOne({ _id, deletedAt: null }, { $set: { deletedAt: new Date().toISOString() } });
      return "Successfully deleted code.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return { createIndex, createSearchIndex, createUniqueIndex, createAssetCode, getAssetCodesByType, updateAssetCodeById, deleteAssetCode };
}
