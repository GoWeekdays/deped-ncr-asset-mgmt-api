import { ClientSession, ObjectId } from "mongodb";
import { logger, paginate, useAtlas } from "@ph-deped-ncr/utils";
import { MReturn, TReturn } from "./../models/return.model";

export default function useReturnRepository() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("returns");

  async function createIndex() {
    try {
      await collection.createIndexes([{ key: { type: 1 } }]);

      return "Successfully created index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createSearchIndex() {
    try {
      await collection.createIndex({ returnNo: "text", returnedByName: "text", officeName: "text" }, { name: "TextSearch" });

      return "Successfully created search index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createReturn(value: TReturn, session?: ClientSession) {
    const returnSlip = new MReturn(value);

    try {
      const res = await collection.insertOne(returnSlip, { session });
      return "Successfully created return record.";
    } catch (error) {
      logger.log({ level: "error", message: `Create return error: ${error}` });
      throw error;
    }
  }

  async function getReturns({
    page = 1,
    limit = 10,
    sort = {},
    search = "",
    type = "",
    userId = "",
    role = "",
  }: {
    page: number;
    limit: number;
    sort: {};
    search: string;
    type: string;
    userId: string | ObjectId;
    role: string;
  }) {
    page = page > 0 ? page - 1 : 0;

    const query: any = { type };

    sort = Object.keys(sort).length > 0 ? sort : { _id: -1 };

    if (search) {
      query.$text = { $search: `"${search}"` };
    }

    if (typeof userId === "string") {
      userId = new ObjectId(userId);
    }

    if (role && !["admin", "admin-head", "office-chief"].includes(role)) {
      query.$or = [{ returnedBy: userId }, { approvedBy: userId }, { receivedBy: userId }];
    }

    const project = {
      createdAt: 1,
      returnNo: 1,
      returnedByName: "$returner.name",
      officeName: "$office.name",
      status: 1,
    };

    const pipeLine = [
      { $match: query },
      {
        $lookup: {
          from: "users",
          localField: "returnedBy",
          foreignField: "_id",
          as: "returner",
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
                designation: 1,
                officeId: 1,
              },
            },
          ],
        },
      },
      { $unwind: { path: "$returner", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "offices",
          localField: "returner.officeId",
          foreignField: "_id",
          as: "office",
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      { $unwind: { path: "$office", preserveNullAndEmptyArrays: true } },
      ...(role === "office-chief" && userId
        ? [
            {
              $lookup: {
                from: "users",
                localField: "returner.officeId",
                foreignField: "officeId",
                as: "supervisor",
                pipeline: [{ $match: { type: "office-chief" } }],
              },
            },
            { $unwind: { path: "$supervisor", preserveNullAndEmptyArrays: true } },
            { $match: { "supervisor.type": "office-chief", "supervisor._id": userId } },
          ]
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
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getReturnById({ _id }: { _id: string | ObjectId }, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    const project = {
      entityName: 1,
      fundCluster: 1,
      returnNo: 1,
      status: 1,
      itemStocks: 1,
      returnedBy: 1,
      returnedByName: "$returnedByName",
      returnedByDesignation: "$returnedByDesignation",
      approvedBy: 1,
      approvedByName: "$approvedByName",
      approvedByDesignation: "$approvedByDesignation",
      receivedBy: 1,
      receivedByName: "$receivedByName",
      receivedByDesignation: "$receivedByDesignation",
      createdAt: 1,
      approvedAt: 1,
      completedAt: 1,
    };

    const pipeLine = [
      { $match: { _id } },
      {
        $lookup: {
          from: "users",
          localField: "returnedBy",
          foreignField: "_id",
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
                designation: 1,
              },
            },
          ],
          as: "returner",
        },
      },
      { $unwind: { path: "$returner", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "approvedBy",
          foreignField: "_id",
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
                designation: 1,
              },
            },
          ],
          as: "approver",
        },
      },
      { $unwind: { path: "$approver", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "receivedBy",
          foreignField: "_id",
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
                designation: 1,
              },
            },
          ],
          as: "receiver",
        },
      },
      { $unwind: { path: "$receiver", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$itemStocks", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "stocks",
          let: { stockId: "$itemStocks.stockId", stockRemarks: "$itemStocks.stockRemarks" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$stockId"] } } },
            {
              $lookup: {
                from: "assets",
                localField: "assetId",
                foreignField: "_id",
                as: "asset",
              },
            },
            { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: "issueSlips",
                localField: "reference",
                foreignField: "issueSlipNo",
                as: "issueSlip",
              },
            },
            { $unwind: { path: "$issueSlip", preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: "users",
                localField: "issueSlip.receivedBy",
                foreignField: "_id",
                as: "endUser",
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
            { $unwind: { path: "$endUser", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 0,
                stockId: "$_id",
                description: "$asset.description",
                reference: 1,
                endUser: "$endUser.name",
                stockRemarks: "$$stockRemarks",
                unitOfMeasurement: "$asset.unitOfMeasurement",
              },
            },
          ],
          as: "itemStocks",
        },
      },
      { $unwind: { path: "$itemStocks", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$_id",
          entityName: { $first: "$entityName" },
          fundCluster: { $first: "$fundCluster" },
          returnNo: { $first: "$returnNo" },
          status: { $first: "$status" },
          itemStocks: { $push: "$itemStocks" },
          returnedBy: { $first: "$returnedBy" },
          returnedByName: { $first: "$returner.name" },
          returnedByDesignation: { $first: "$returner.designation" },
          approvedBy: { $first: "$approvedBy" },
          approvedByName: { $first: "$approver.name" },
          approvedByDesignation: { $first: "$approver.designation" },
          receivedBy: { $first: "$receivedBy" },
          receivedByName: { $first: "$receiver.name" },
          receivedByDesignation: { $first: "$receiver.designation" },
          createdAt: { $first: "$createdAt" },
          approvedAt: { $first: "$approvedAt" },
          completedAt: { $first: "$completedAt" },
        },
      },
      { $project: project },
    ];

    try {
      const res = await collection.aggregate(pipeLine, { session }).toArray();
      return res[0];
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateReturnById(_id: string | ObjectId, value: Partial<TReturn>, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    if (value.approvedBy) {
      if (typeof value.approvedBy === "string") {
        value.approvedBy = new ObjectId(value.approvedBy);
      }
    }

    if (value.receivedBy) {
      if (typeof value.receivedBy === "string") {
        value.receivedBy = new ObjectId(value.receivedBy);
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

  return { createIndex, createSearchIndex, createReturn, getReturns, getReturnById, updateReturnById };
}
