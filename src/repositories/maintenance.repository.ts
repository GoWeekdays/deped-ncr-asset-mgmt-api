import { ClientSession, ObjectId } from "mongodb";
import { logger, paginate, useAtlas } from "@ph-deped-ncr/utils";
import { MMaintenance, TMaintenance } from "./../models/maintenance.model";
import { TKeyValuePair } from "./../local";

export default function useMaintenanceRepository() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("maintenances");

  async function createSearchIndex() {
    try {
      await collection.createIndex({ name: "text", officeName: "text", issue: "text", type: "text", status: "text" }, { name: "TextSearch" });

      return "Successfully created search index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createMaintenance(value: TMaintenance, session?: ClientSession) {
    const maintenance = new MMaintenance(value);

    try {
      await collection.insertOne(maintenance, { session });
      return "Successfully created maintenance.";
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getMaintenances({
    page = 1,
    limit = 10,
    sort = {},
    search = "",
    role = "",
    officeId = "",
  }: {
    page?: number;
    limit?: number;
    sort?: TKeyValuePair;
    search?: string;
    role?: string;
    officeId?: string | ObjectId;
  } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: any = {};

    sort = Object.keys(sort).length > 0 ? sort : { _id: -1 };

    if (search) {
      query.$text = { $search: search };
    }

    if (typeof officeId === "string") {
      officeId = new ObjectId(officeId);
    }

    const project = {
      stockId: 1,
      name: "$itemStocks.name",
      officeName: "$office.name",
      issue: 1,
      scheduledAt: 1,
      type: 1,
      status: 1,
    };

    const pipeLine = [
      { $match: query },
      {
        $lookup: {
          from: "stocks",
          localField: "stockId",
          foreignField: "_id",
          pipeline: [
            {
              $lookup: {
                from: "assets",
                localField: "assetId",
                foreignField: "_id",
                as: "asset",
                pipeline: [{ $project: { name: 1 } }],
              },
            },
            { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
            { $project: { name: "$asset.name", officeId: 1 } },
          ],
          as: "itemStocks",
        },
      },
      { $unwind: { path: "$itemStocks", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "assigneeId",
          foreignField: "_id",
          as: "assignee",
          pipeline: [{ $project: { officeId: 1 } }],
        },
      },
      { $unwind: { path: "$assignee", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "offices",
          localField: "assignee.officeId",
          foreignField: "_id",
          as: "office",
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      { $unwind: { path: "$office", preserveNullAndEmptyArrays: true } },
      ...(role === "office-chief" || role === "personnel"
        ? [{ $match: { "itemStocks.officeId": officeId } }]
        : role === "admin" || role === "admin-head"
          ? []
          : []),
    ];

    const pipelineForItems = [...pipeLine, { $project: project }, { $sort: sort }, { $skip: page * limit }, { $limit: limit }];
    const pipelineForCount = [...pipeLine, { $count: "totalCount" }];

    try {
      const items = await collection.aggregate(pipelineForItems).toArray();
      const countResult = await collection.aggregate(pipelineForCount).toArray();
      const length = countResult.length > 0 ? countResult[0].totalCount : 0;

      return paginate(items, page, limit, length);
    } catch (error) {
      logger.log({ level: "error", message: `Error in getMaintenances: ${error}` });
      throw error;
    }
  }

  async function getMaintenanceById(_id: string | ObjectId, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    const project = {
      status: 1,
      name: "$asset.name",
      description: "$asset.description",
      completedByName: "$completer.name",
      code: 1,
      assigneeName: "$assignee.name",
      officeName: "$office.name",
      createdAt: 1,
      scheduledAt: 1,
      issue: 1,
      type: 1,
      rescheduleReason: 1,
      remarks: 1,
      attachment: 1,
    };

    const pipeLine = [
      { $match: { _id } },
      {
        $lookup: {
          from: "stocks",
          localField: "stockId",
          foreignField: "_id",
          pipeline: [
            {
              $lookup: {
                from: "assets",
                localField: "assetId",
                foreignField: "_id",
                as: "asset",
                pipeline: [{ $project: { name: 1 } }],
              },
            },
            { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
            { $project: { name: "$asset.name" } },
          ],
          as: "itemStocks",
        },
      },
      { $unwind: { path: "$itemStocks", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "assigneeId",
          foreignField: "_id",
          as: "assignee",
          pipeline: [
            {
              $project: {
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
                officeId: 1,
              },
            },
          ],
        },
      },
      { $unwind: { path: "$assignee", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "offices",
          localField: "assignee.officeId",
          foreignField: "_id",
          as: "office",
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      { $unwind: { path: "$office", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "completedBy",
          foreignField: "_id",
          as: "completer",
          pipeline: [
            {
              $project: {
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
        },
      },
      { $unwind: { path: "$completer", preserveNullAndEmptyArrays: true } },
      { $project: project },
    ];

    try {
      const items = await collection.aggregate(pipeLine, { session }).toArray();
      return items[0];
    } catch (error) {
      logger.log({ level: "error", message: `Error in getMaintenanceById: ${error}` });
      throw error;
    }
  }

  async function updateMaintenanceById(_id: string | ObjectId, value: Partial<TMaintenance>, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    if (value.completedBy) {
      if (typeof value.completedBy === "string") {
        value.completedBy = new ObjectId(value.completedBy);
      }
    }

    try {
      value.updatedAt = new Date().toISOString();
      return await collection.updateOne({ _id }, { $set: value }, { session });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createSearchIndex,
    createMaintenance,
    getMaintenances,
    getMaintenanceById,
    updateMaintenanceById,
  };
}
