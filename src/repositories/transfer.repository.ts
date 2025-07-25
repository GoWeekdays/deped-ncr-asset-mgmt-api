import { ClientSession, ObjectId } from "mongodb";
import { logger, paginate, useAtlas } from "@ph-deped-ncr/utils";
import { MTransfer, TTransfer } from "./../models/transfer.model";

export default function useTransferRepository() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("transfers");

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
      await collection.createIndex({ transferNo: "text", to: "text", transferType: "text" }, { name: "TextSearch" });

      return "Successfully created search index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createTransfer(value: TTransfer, session?: ClientSession) {
    const transfer = new MTransfer(value);

    try {
      const res = await collection.insertOne(transfer, { session });
      return res.insertedId.toString();
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getTransfers({ page = 1, limit = 10, sort = {}, search = "", type = "" } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: any = { type };

    sort = Object.keys(sort).length > 0 ? sort : { _id: -1 };

    if (search) {
      query.$text = { $search: search };
    }

    const project = {
      _id: 1,
      type: 1,
      transferNo: 1,
      from: 1,
      to: 1,
      transferType: 1,
      status: 1,
      createdAt: 1,
      completedAt: 1,
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

  async function getTransferById({ _id }: { _id: string | ObjectId }) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    const project = {
      entityName: 1,
      fundCluster: 1,
      from: 1,
      to: 1,
      transferNo: 1,
      transferType: 1,
      status: 1,
      transferReason: 1,
      itemStocks: 1,
      approvedBy: 1,
      approvedByName: "$approver.name",
      approvedByDesignation: "$approver.designation",
      issuedBy: 1,
      issuedByName: "$issuer.name",
      issuedByDesignation: "$issuer.designation",
      receivedByName: 1,
      receivedByDesignation: 1,
      createdAt: 1,
      approvedAt: 1,
      completedAt: 1,
    };

    const pipeLine = [
      { $match: { _id } },
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
          from: "stocks",
          let: { itemStocks: "$itemStocks" },
          pipeline: [
            { $match: { $expr: { $in: ["$_id", "$$itemStocks.stockId"] } } },
            {
              $lookup: {
                from: "assets",
                localField: "assetId",
                foreignField: "_id",
                as: "asset",
                pipeline: [
                  {
                    $project: {
                      stockNumber: 1,
                      description: 1,
                      unitOfMeasurement: 1,
                      cost: 1,
                      createdAt: 1,
                    },
                  },
                ],
              },
            },
            { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 0,
                stockId: "$_id",
                createdAt: "$asset.createdAt",
                itemNo: 1,
                reference: {
                  $cond: {
                    if: { $eq: ["$condition", "issued"] },
                    then: "$reference",
                    else: "$$REMOVE",
                  },
                },
                stockNumber: "$asset.stockNumber",
                description: "$asset.description",
                unitOfMeasurement: "$asset.unitOfMeasurement",
                cost: "$asset.cost",
                condition: 1,
              },
            },
            { $addFields: { originalIndex: { $indexOfArray: ["$$itemStocks.stockId", "$stockId"] } } },
            { $sort: { originalIndex: 1 } },
          ],
          as: "itemStocks",
        },
      },
      { $project: project },
    ];

    try {
      const res = await collection.aggregate<TTransfer>(pipeLine).toArray();
      return res[0];
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateTransferById(_id: string | ObjectId, value: Partial<TTransfer>, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    if (value.itemStocks) {
      value.itemStocks = value.itemStocks.map((item) => ({
        ...item,
        stockId: typeof item.stockId === "string" ? new ObjectId(item.stockId) : item.stockId,
      }));
    }

    if (value.approvedBy) {
      if (typeof value.approvedBy === "string") {
        value.approvedBy = new ObjectId(value.approvedBy);
      }
    }

    if (value.issuedBy) {
      if (typeof value.issuedBy === "string") {
        value.issuedBy = new ObjectId(value.issuedBy);
      }
    }

    value.updatedAt = new Date().toISOString();

    try {
      return await collection.updateOne({ _id }, { $set: value }, { session });
    } catch (error) {
      logger.log({ level: "error", message: `Error in updateTransferById: ${error}` });
      throw error;
    }
  }

  return { createIndex, createSearchIndex, createTransfer, getTransfers, getTransferById, updateTransferById };
}
