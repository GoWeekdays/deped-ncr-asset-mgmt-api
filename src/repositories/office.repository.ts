import { ObjectId } from "mongodb";
import { BadRequestError, logger, paginate, useAtlas } from "@ph-deped-ncr/utils";
import { MOffice, TOffice } from "./../models/office.model";

export default function useOfficeRepository() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("offices");

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
      await collection.createIndex({ name: 1, deletedAt: 1 }, { name: "UniqueIndex", unique: true });

      return "Successfully created unique index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createOffice(value: TOffice) {
    const office = new MOffice(value);

    try {
      const existingName = await collection.findOne({ name: value.name, deletedAt: null });
      if (existingName) {
        throw new BadRequestError("Office name already exists.");
      }

      await collection.insertOne(office);
      return "Successfully created office.";
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });

      const isDuplicated = error.message.includes("duplicate");
      if (isDuplicated) {
        throw new BadRequestError("Office name already exists.");
      }

      throw error;
    }
  }

  async function getOffices({ page = 1, limit = 10, sort = {}, search = "" } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: any = { deletedAt: null };

    sort = Object.keys(sort).length > 0 ? sort : { name: 1 };

    if (search) {
      query.$text = { $search: search };
    }

    const project = {
      _id: 1,
      name: 1,
      email: 1,
      divisionId: 1,
      divisionName: "$division.name",
      supervisorName: "$supervisor.name",
    };

    const pipeLine = [
      { $match: query },
      {
        $lookup: {
          from: "divisions",
          localField: "divisionId",
          foreignField: "_id",
          pipeline: [{ $project: { name: 1 } }],
          as: "division",
        },
      },
      { $unwind: { path: "$division", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "officeId",
          pipeline: [
            { $match: { type: "office-chief" } },
            {
              $project: {
                _id: 0,
                name: {
                  $trim: {
                    input: {
                      $concat: [
                        { $cond: { if: { $ne: ["$title", ""] }, then: { $concat: ["$title", " "] }, else: "" } },
                        "$firstName",
                        " ",
                        "$lastName",
                        { $cond: { if: { $ne: ["$suffix", ""] }, then: { $concat: [" ", "$suffix"] }, else: "" } },
                      ],
                    },
                  },
                },
              },
            },
          ],
          as: "supervisor",
        },
      },
      { $unwind: { path: "$supervisor", preserveNullAndEmptyArrays: true } },
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

  async function getOfficeById(_id: string | ObjectId) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    const project = {
      _id: 1,
      name: 1,
      email: 1,
      divisionId: 1,
      divisionName: "$division.name",
      supervisorName: "$supervisor.name",
    };

    const pipeLine = [
      { $match: { _id, deletedAt: null } },
      {
        $lookup: {
          from: "divisions",
          localField: "divisionId",
          foreignField: "_id",
          pipeline: [{ $project: { name: 1 } }],
          as: "division",
        },
      },
      { $unwind: { path: "$division", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "id",
          foreignField: "officeId",
          pipeline: [
            { $match: { type: "office-chief" } },
            {
              $project: {
                _id: 0,
                name: {
                  $trim: {
                    input: {
                      $concat: [
                        { $cond: { if: { $ne: ["$title", ""] }, then: { $concat: ["$title", " "] }, else: "" } },
                        "$firstName",
                        " ",
                        "$lastName",
                        { $cond: { if: { $ne: ["$suffix", ""] }, then: { $concat: [" ", "$suffix"] }, else: "" } },
                      ],
                    },
                  },
                },
              },
            },
          ],
          as: "supervisor",
        },
      },
      { $unwind: { path: "$supervisor", preserveNullAndEmptyArrays: true } },
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

  async function updateOffice(_id: string | ObjectId, value: TOffice) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    if (typeof value.divisionId === "string") {
      value.divisionId = new ObjectId(value.divisionId);
    }

    try {
      const existingName = await collection.findOne({ name: value.name, _id: { $ne: _id }, deletedAt: null });
      if (existingName) {
        throw new BadRequestError("Office name already exists.");
      }

      value.updatedAt = new Date().toISOString();

      await collection.updateOne({ _id }, { $set: value });

      return "Successfully updated office.";
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });

      const isDuplicated = error.message.includes("duplicate");
      if (isDuplicated) {
        throw new BadRequestError("Office name already exists.");
      }

      throw error;
    }
  }

  async function deleteOffice(_id: string | ObjectId) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      await collection.updateOne({ _id }, { $set: { deletedAt: new Date().toISOString() } });
      return "Successfully deleted office.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getOfficeNames(search?: string) {
    try {
      const query: any = { deletedAt: null };

      if (search) {
        query.$text = { $search: search };
      }

      const pipeLine = [{ $match: query }];

      return await collection.aggregate([...pipeLine, { $project: { name: 1 } }]).toArray();
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getOfficesWithoutOfficeChief(type: string) {
    const query: any = { deletedAt: null };

    const project = {
      _id: 1,
      name: 1,
    };

    const pipeLine = [
      { $match: query },
      {
        $lookup: {
          from: "divisions",
          localField: "divisionId",
          foreignField: "_id",
          pipeline: [{ $project: { name: 1 } }],
          as: "division",
        },
      },
      { $unwind: { path: "$division", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "officeId",
          foreignField: "_id",
          pipeline: [{ $match: { type: "office-chief" } }],
          as: "supervisor",
        },
      },
      { $unwind: { path: "$supervisor", preserveNullAndEmptyArrays: true } },
    ];

    if (type === "office-chief") {
      pipeLine.push({
        $match: { supervisor: { $eq: null } },
      });
    }

    const pipelineForItems = [...pipeLine, { $project: project }];

    try {
      return await collection.aggregate(pipelineForItems).toArray();
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createIndex,
    createSearchIndex,
    createUniqueIndex,
    createOffice,
    getOffices,
    getOfficeById,
    updateOffice,
    deleteOffice,
    getOfficeNames,
    getOfficesWithoutOfficeChief,
  };
}
