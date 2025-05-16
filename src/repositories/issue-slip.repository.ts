import { logger, paginate, useAtlas } from "@ph-deped-ncr/utils";
import { ClientSession, ObjectId } from "mongodb";
import { MIssueSlip, TIssueSlip } from "./../models/issue-slip.model";

export default function useIssueSlipRepository() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("issueSlips");

  async function createIndex() {
    try {
      await collection.createIndexes([{ key: { type: 1 } }, { key: { type: 1, receivedBy: 1, status: 1 } }, { key: { issueSlipNo: 1 } }]);

      return "Successfully created index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createSearchIndex() {
    try {
      await collection.createIndex({ issueSlipNo: "text", receivedByName: "text", issuedByName: "text" }, { name: "TextSearch" });

      return "Successfully created search index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createIssueSlip(value: TIssueSlip, session?: ClientSession) {
    const issueSlip = new MIssueSlip(value);

    try {
      return await collection.insertOne(issueSlip, { session });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getIssueSlips({
    page = 1,
    limit = 10,
    sort = {},
    search = "",
    type = "",
    role = "",
    userId = "",
  }: {
    page: number;
    limit: number;
    sort: {};
    search: string;
    type: string;
    role: string;
    userId: string | ObjectId;
  }) {
    page = page > 0 ? page - 1 : 0;

    const query: any = { type };

    sort = Object.keys(sort).length > 0 ? sort : { _id: -1 };

    if (search) {
      query.$text = { $search: search };
    }

    if (typeof userId === "string") {
      userId = new ObjectId(userId);
    }

    if (role && !["admin", "admin-head", "office-chief"].includes(role)) {
      query.$or = [{ receivedBy: userId }, { issuedBy: userId }];
    }

    const project = {
      createdAt: 1,
      receivedAt: 1,
      issueSlipNo: 1,
      receivedByName: 1,
      status: 1,
    };

    const pipeLine = [
      { $match: query },
      {
        $lookup: {
          from: "users",
          localField: "receivedBy",
          foreignField: "_id",
          as: "receiver",
        },
      },
      { $unwind: { path: "$receiver", preserveNullAndEmptyArrays: true } },
      ...(role === "office-chief" && userId
        ? [
            {
              $lookup: {
                from: "users",
                localField: "receiver.officeId",
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

  async function getIssueSlipsByReceiver({ page = 1, limit = 10, sort = {}, search = "", type = "", receivedBy = "" } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: any = { type, status: "issued" };

    if (typeof receivedBy === "string") {
      query.receivedBy = new ObjectId(receivedBy);
    }

    sort = Object.keys(sort).length > 0 ? sort : { _id: -1 };

    if (search) {
      query.$text = { $search: search };
    }

    const project = {
      _id: 0,
      issueSlipId: "$_id",
      issueSlipNo: 1,
      issuedAt: "$receivedAt",
    };

    const excludedConditions = ["transferred", "lost", "stolen", "damaged", "destroyed", "returned", "for-disposal"];

    const pipeLine = [
      { $match: query },
      {
        $lookup: {
          from: "stocks",
          localField: "issueSlipNo",
          foreignField: "reference",
          as: "stocks",
        },
      },
      {
        $addFields: {
          returnedTotal: {
            $sum: {
              $map: {
                input: "$stocks",
                as: "stock",
                in: { $cond: [{ $eq: ["$$stock.condition", "returned"] }, "$$stock.ins", 0] },
              },
            },
          },
          excludedConditionsTotal: {
            $sum: {
              $map: {
                input: "$stocks",
                as: "stock",
                in: { $cond: [{ $in: ["$$stock.condition", excludedConditions] }, "$$stock.outs", 0] },
              },
            },
          },
        },
      },
      {
        $addFields: {
          totalQuantity: {
            $subtract: ["$quantity", { $add: ["$returnedTotal", "$excludedConditionsTotal"] }],
          },
        },
      },
      { $match: { totalQuantity: { $gt: 0 } } },
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

  async function getIssueSlipById(_id: string | ObjectId, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    const project = {
      entityName: 1,
      fundCluster: 1,
      issueSlipNo: 1,
      quantity: 1,
      assetId: 1,
      unitOfMeasurement: "$asset.unitOfMeasurement",
      cost: "$asset.cost",
      description: "$asset.description",
      stockNumber: "$asset.stockNumber",
      itemNo: "$issueItemNo",
      issueItemNo: 1,
      estimatedUsefulLife: 1,
      remarks: 1,
      receivedBy: 1,
      receivedByName: 1,
      receivedAt: 1,
      receivedByDesignation: "$receiver.designation",
      issuedBy: 1,
      issuedByName: "$issuer.name",
      issuedByDesignation: "$issuer.designation",
      status: 1,
      createdAt: 1,
      updatedAt: 1,
    };

    const pipeLine = [
      { $match: { _id } },
      {
        $lookup: {
          from: "assets",
          localField: "assetId",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                unitOfMeasurement: 1,
                cost: 1,
                description: 1,
                stockNumber: 1,
              },
            },
          ],
          as: "asset",
        },
      },
      { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
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
      {
        $lookup: {
          from: "users",
          localField: "issuedBy",
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
          as: "issuer",
        },
      },
      { $unwind: { path: "$issuer", preserveNullAndEmptyArrays: true } },
      { $project: project },
    ];

    try {
      const res = await collection.aggregate<TIssueSlip>(pipeLine, { session }).toArray();
      return res[0];
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateStatusById(_id: string | ObjectId, status: string, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    const updateOptions: Record<string, string> = { status, updatedAt: new Date().toISOString() };

    try {
      return await collection.updateOne({ _id }, { $set: updateOptions }, { session });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function issue(
    { _id, issuedBy, issuedByName, itemNo, issueItemNo } = {} as {
      _id: string | ObjectId;
      issuedBy: string | ObjectId;
      issuedByName: string;
      itemNo: string;
      issueItemNo: string;
    },
    session?: ClientSession,
  ) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    if (typeof issuedBy === "string") {
      issuedBy = new ObjectId(issuedBy);
    }

    try {
      return await collection.updateOne(
        { _id },
        {
          $set: {
            status: "issued",
            issuedBy,
            issuedByName,
            itemNo,
            issueItemNo,
            receivedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
        { session },
      );
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createIndex,
    createSearchIndex,
    createIssueSlip,
    getIssueSlips,
    getIssueSlipsByReceiver,
    getIssueSlipById,
    updateStatusById,
    issue,
  };
}
