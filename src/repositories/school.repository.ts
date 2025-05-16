import { ObjectId } from "mongodb";
import { BadRequestError, logger, paginate, useAtlas } from "@ph-deped-ncr/utils";
import { MSchool, TSchool } from "./../models/school.model";

export default function useSchoolRepository() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("schools");

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

  async function createSchool(value: TSchool) {
    const school = new MSchool(value);

    try {
      const existingName = await collection.findOne({ name: value.name, deletedAt: null });
      if (existingName) {
        throw new BadRequestError("School name already exists.");
      }

      const res = await collection.insertOne(school);

      if (!res.insertedId) {
        throw new BadRequestError("Failed to fetch newly created school details.");
      }

      return await getSchoolById(res.insertedId);
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });

      const isDuplicated = error.message.includes("duplicate");
      if (isDuplicated) {
        throw new BadRequestError("School name already exists.");
      }

      throw error;
    }
  }

  async function getSchools({ page = 1, limit = 10, sort = {}, search = "", divisionId = "" } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: any = { deletedAt: null };

    if (divisionId) {
      if (typeof divisionId === "string") {
        query.divisionId = new ObjectId(divisionId);
      }
    }

    sort = Object.keys(sort).length > 0 ? sort : { name: 1 };

    if (search) {
      query.$text = { $search: search };
    }

    const project = {
      _id: 1,
      name: 1,
      divisionId: 1,
      divisionName: "$division.name",
    };

    const pipeLine = [
      { $match: query },
      {
        $lookup: {
          from: "schoolDivisions",
          localField: "divisionId",
          foreignField: "_id",
          as: "division",
        },
      },
      { $unwind: { path: "$division", preserveNullAndEmptyArrays: true } },
    ];

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

  async function getSchoolById(_id: string | ObjectId) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    const project = {
      _id: 1,
      name: 1,
      divisionId: 1,
      divisionName: "$division.name",
    };

    const pipeLine = [
      { $match: { _id, deletedAt: null } },
      {
        $lookup: {
          from: "schoolDivisions",
          localField: "divisionId",
          foreignField: "_id",
          as: "division",
        },
      },
      { $unwind: { path: "$division", preserveNullAndEmptyArrays: true } },
      { $project: project },
    ];

    try {
      const data = await collection.aggregate(pipeLine).toArray();
      return data[0];
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateSchool(_id: string | ObjectId, value: TSchool) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    if (typeof value.divisionId === "string") {
      value.divisionId = new ObjectId(value.divisionId);
    }

    try {
      const existingName = await collection.findOne({ name: value.name, _id: { $ne: _id }, deletedAt: null });
      if (existingName) {
        throw new BadRequestError("School name already exists.");
      }

      value.updatedAt = new Date().toISOString();

      await collection.updateOne({ _id }, { $set: value });
      return "Successfully updated school.";
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });

      const isDuplicated = error.message.includes("duplicate");
      if (isDuplicated) {
        throw new BadRequestError("School name already exists.");
      }

      throw error;
    }
  }

  async function deleteSchool(_id: string | ObjectId) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      await collection.updateOne({ _id }, { $set: { deletedAt: new Date().toISOString() } });
      return "Successfully deleted school.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return { createIndex, createSearchIndex, createUniqueIndex, createSchool, getSchools, getSchoolById, updateSchool, deleteSchool };
}
