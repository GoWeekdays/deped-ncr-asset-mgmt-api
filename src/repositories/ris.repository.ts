import { ClientSession, ObjectId } from "mongodb";
import { logger, paginate, useAtlas } from "@ph-deped-ncr/utils";
import { MRISlip, TRISlip } from "./../models/ris.model";

export default function useRISlipRepository() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("ris");

  async function createIndex() {
    try {
      await collection.createIndexes([{ key: { status: 1 } }]);

      return "Successfully created index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createSearchIndex() {
    try {
      await collection.createIndex({ risNo: "text", requestedByName: "text" }, { name: "TextSearch" });

      return "Successfully created search index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createRISlip(value: TRISlip, session?: ClientSession) {
    const ris = new MRISlip(value);

    try {
      return await collection.insertOne(ris, { session });
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getRISlips({
    page = 1,
    limit = 10,
    sort = {},
    search = "",
    role = "",
    user = "",
  }: {
    page: number;
    limit: number;
    sort: {};
    search: string;
    role: string;
    user: string | ObjectId;
  }) {
    page = page > 0 ? page - 1 : 0;

    const query: any = {};

    sort = Object.keys(sort).length > 0 ? sort : { _id: -1 };

    if (search) {
      query.$text = { $search: `"${search}"` };
    }

    if (typeof user === "string") {
      user = new ObjectId(user);
    }

    if (role && !["admin", "admin-head", "office-chief"].includes(role)) {
      query.requestedBy = user;
    }

    const project = {
      risNo: 1,
      requestedBy: 1,
      requestedByName: "$requestee.name",
      status: 1,
      createdAt: 1,
    };

    const pipeLine = [
      { $match: query },
      {
        $lookup: {
          from: "users",
          localField: "requestedBy",
          foreignField: "_id",
          as: "requestee",
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
      { $unwind: { path: "$requestee", preserveNullAndEmptyArrays: true } },
      ...(role === "office-chief" && user
        ? [
            {
              $lookup: {
                from: "users",
                localField: "requestee.officeId",
                foreignField: "officeId",
                as: "supervisor",
                pipeline: [{ $match: { type: "office-chief" } }],
              },
            },
            { $unwind: { path: "$supervisor", preserveNullAndEmptyArrays: true } },
            { $match: { "supervisor.type": "office-chief", "supervisor._id": user } },
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

  async function getReportRISlips({ sort = {}, search = "" } = {}) {
    const query: any = { status: "issued" };

    sort = Object.keys(sort).length > 0 ? sort : { risNo: 1 };

    if (search) {
      query.$text = { $search: `"${search}"` };
    }

    const project = { risNo: 1 };

    const pipeLine = [{ $match: query }];

    const pipelineForItems = [...pipeLine, { $project: project }, { $sort: sort }];

    try {
      return await collection.aggregate(pipelineForItems).toArray();
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getRISlipById({ _id, role }: { _id: string | ObjectId; role?: string }, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    const project = {
      entityName: 1,
      fundCluster: 1,
      divisionId: 1,
      division: "$division",
      officeId: 1,
      office: "$office",
      rcc: 1,
      purpose: 1,
      risNo: 1,
      itemStocks: 1,
      requestedBy: 1,
      requestedByName: "$requestedByName",
      requestedByDesignation: "$requestedByDesignation",
      approvedByName: "$approvedByName",
      approvedByDesignation: "$approvedByDesignation",
      issuedByName: "$issuedByName",
      issuedByDesignation: "$issuedByDesignation",
      receivedByName: "$receivedByName",
      receivedByDesignation: "$receivedByDesignation",
      remarks: 1,
      status: 1,
      createdAt: 1,
      approvedAt: 1,
      completedAt: 1,
    };

    const pipeLine = [
      { $match: { _id } },
      {
        $lookup: {
          from: "offices",
          localField: "officeId",
          foreignField: "_id",
          as: "office",
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      { $unwind: { path: "$office", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "divisions",
          localField: "divisionId",
          foreignField: "_id",
          as: "division",
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      { $unwind: { path: "$division", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$itemStocks", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "assets",
          let: {
            assetId: "$itemStocks.assetId",
            requestQty: "$itemStocks.requestQty",
            issueQty: "$itemStocks.issueQty",
            remarks: "$itemStocks.remarks",
            role,
          },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$assetId"] } } },
            {
              $project: {
                _id: 0,
                assetId: "$_id",
                stockNumber: 1,
                unitOfMeasurement: 1,
                name: 1,
                description: 1,
                isAvailable: {
                  $cond: {
                    if: { $gte: ["$quantity", "$$requestQty"] },
                    then: "yes",
                    else: "no",
                  },
                },
                requestQty: "$$requestQty",
                issueQty: "$$issueQty",
                remarks: "$$remarks",
                stockQty: {
                  $cond: {
                    if: {
                      $or: [{ $eq: ["$$role", "admin"] }, { $eq: ["$$role", "admin-head"] }],
                    },
                    then: "$quantity",
                    else: "$$REMOVE",
                  },
                },
              },
            },
          ],
          as: "itemStocks",
        },
      },
      { $unwind: { path: "$itemStocks", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "requestedBy",
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
          as: "requestee",
        },
      },
      { $unwind: { path: "$requestee", preserveNullAndEmptyArrays: true } },
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
        $group: {
          _id: "$_id",
          entityName: { $first: "$entityName" },
          fundCluster: { $first: "$fundCluster" },
          divisionId: { $first: "$divisionId" },
          division: { $first: "$division.name" },
          officeId: { $first: "$officeId" },
          office: { $first: "$office.name" },
          rcc: { $first: "$rcc" },
          purpose: { $first: "$purpose" },
          risNo: { $first: "$risNo" },
          itemStocks: { $push: "$itemStocks" },
          requestedBy: { $first: "$requestedBy" },
          requestedByName: { $first: "$requestee.name" },
          requestedByDesignation: { $first: "$requestee.designation" },
          approvedByName: { $first: "$approver.name" },
          approvedByDesignation: { $first: "$approver.designation" },
          issuedByName: { $first: "$issuer.name" },
          issuedByDesignation: { $first: "$issuer.designation" },
          receivedByName: { $first: "$receiver.name" },
          receivedByDesignation: { $first: "$receiver.designation" },
          remarks: { $first: "$remarks" },
          status: { $first: "$status" },
          createdAt: { $first: "$createdAt" },
          approvedAt: { $first: "$approvedAt" },
          completedAt: { $first: "$completedAt" },
        },
      },
      { $project: project },
    ];

    try {
      const res = await collection.aggregate<TRISlip>(pipeLine, { session }).toArray();
      return res[0];
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getReportRISlipById({ _id }: { _id: string | ObjectId }, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    const project = {
      entityName: 1,
      fundCluster: 1,
      serialNo: 1,
      itemStocks: 1,
      createdAt: 1,
    };

    const pipeLine = [
      { $match: { _id } },
      {
        $lookup: {
          from: "risSerialNo",
          localField: "_id",
          foreignField: "risId",
          as: "serialNos",
        },
      },
      {
        $project: {
          entityName: 1,
          fundCluster: 1,
          serialNo: {
            $cond: {
              if: { $gt: [{ $size: "$serialNos" }, 0] },
              then: { $arrayElemAt: ["$serialNos.serialNo", -1] },
              else: "",
            },
          },
          risNo: 1,
          rcc: 1,
          itemStocks: 1,
          createdAt: 1,
        },
      },
      { $unwind: { path: "$itemStocks", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "assets",
          let: {
            assetId: "$itemStocks.assetId",
            risNo: "$risNo",
            rcc: "$rcc",
            issueQty: "$itemStocks.issueQty",
          },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$assetId"] } } },
            {
              $project: {
                _id: 0,
                assetId: "$_id",
                risNo: "$$risNo",
                rcc: "$$rcc",
                stockNumber: 1,
                name: 1,
                unitOfMeasurement: 1,
                issueQty: "$$issueQty",
                cost: { $ifNull: ["$cost", 0] },
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
          serialNo: { $first: "$serialNo" },
          itemStocks: { $push: "$itemStocks" },
          createdAt: { $first: "$createdAt" },
        },
      },
      { $project: project },
    ];

    try {
      const res = await collection.aggregate<TRISlip>(pipeLine, { session }).toArray();
      return res[0];
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateRISlipById(_id: string | ObjectId, value: Partial<TRISlip>, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    if (value.issuedBy) {
      if (typeof value.issuedBy === "string") {
        value.issuedBy = new ObjectId(value.issuedBy);
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

  async function updateRISlipStatusById(_id: string | ObjectId, status: string, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      await updateRISlipById(_id, { status }, session);
      return `Successfully updated RIS status to ${status}.`;
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createIndex,
    createSearchIndex,
    createRISlip,
    getRISlips,
    getReportRISlips,
    getRISlipById,
    getReportRISlipById,
    updateRISlipById,
    updateRISlipStatusById,
  };
}
