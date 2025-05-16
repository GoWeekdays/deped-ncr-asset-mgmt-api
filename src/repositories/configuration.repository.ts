import { ObjectId } from "mongodb";
import { BadRequestError, InternalServerError, logger, paginate, useAtlas } from "@ph-deped-ncr/utils";
import { MConfig, TConfig } from "./../models/configuration.model";

export default function useConfigRepository() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("configuration");

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
      await collection.createIndex({ name: "text", value: "text" }, { name: "TextSearch" });

      return "Successfully created search index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createUniqueIndex() {
    try {
      await collection.createIndex({ name: 1, deletedAt: 1 }, { name: "UniqueIndex", unique: true });

      return "Successfully created unique index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createConfig(value: TConfig) {
    const configuration = new MConfig(value);

    try {
      const existingConfig = await collection.findOne({ name: value.name, deletedAt: null });
      if (existingConfig) {
        throw new BadRequestError("Configuration name already exists.");
      }

      return await collection.insertOne(configuration);
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });

      const isDuplicated = error.message.includes("duplicate");
      if (isDuplicated) {
        throw new BadRequestError("Configuration name already exists.");
      }

      throw error;
    }
  }

  async function getConfigs({ page = 1, limit = 10, sort = {}, search = "" } = {}) {
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

  async function getConfigByName(name: string) {
    try {
      const config = await collection.findOne<TConfig>({ name, deletedAt: null }, { projection: { value: 1 } });
      return config?.value ?? "";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw new InternalServerError("Failed to find configuration.");
    }
  }

  async function updateConfig({ _id, value } = {} as { _id: string | ObjectId; value: TConfig }) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      await collection.updateOne({ _id }, { $set: value });
      return "Successfully updated configuration.";
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });

      const isDuplicated = error.message.includes("duplicate");

      if (isDuplicated) {
        throw new BadRequestError("Configuration name already exists.");
      }

      throw error;
    }
  }

  async function deleteConfig(_id: string | ObjectId) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      await collection.updateOne({ _id }, { $set: { deletedAt: new Date().toISOString() } });
      return "Successfully deleted configuration.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createIndex,
    createSearchIndex,
    createUniqueIndex,
    createConfig,
    getConfigs,
    getConfigByName,
    updateConfig,
    deleteConfig,
  };
}
